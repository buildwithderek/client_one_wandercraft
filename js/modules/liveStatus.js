/**
 * Multi-platform live-status polling for creator channels.
 *
 * Architecture matches Hermitcraft's pattern (creator list + per-platform
 * isLive flags) but does the polling client-side where possible and leaves
 * a clean provider seam for platforms that need a backend.
 *
 *   Twitch   → decapi.me public proxy, no auth required, works in browser
 *   YouTube  → no public no-auth proxy and no CORS, so the check runs in
 *              our own Worker (/live). Wire it with createYouTubeProvider()
 *              once LIVE_WORKER_BASE_URL is set. Default: returns false.
 *   TikTok   → same story as YouTube: no public API, no CORS. Runs through
 *              the Worker's /live?platform=tiktok. Wire it with
 *              createTikTokProvider(). Default: returns false.
 *
 * Public API:
 *   start(creators, opts?)   — begin polling on an interval; returns stop fn
 *   subscribe(listener)      — get notified on every per-platform change;
 *                              returns unsubscribe
 *   getStatus(id, platform)  — synchronous read of last known status
 *   anyLiveFor(id)           — true if creator is live on ANY platform
 *
 * opts.providers shape (all optional, default to noop):
 *   {
 *     twitch:  async (handle) => boolean,
 *     youtube: async (handle) => boolean,
 *     tiktok:  async (handle) => boolean,
 *   }
 *
 * The default `start()` uses the built-in Twitch (decapi) provider and
 * noop providers for the other two. To enable YouTube live detection,
 * pass `{ providers: { youtube: yourYouTubeFn } }`.
 */

const PLATFORMS = ['twitch', 'youtube', 'tiktok'];

/** Per-creator handle field name on creators.js. */
const HANDLE_FIELD = {
  twitch:  'twitchUsername',
  youtube: 'youtubeHandle',
  tiktok:  'tiktokHandle',
};

const DECAPI_UPTIME = (user) => `https://decapi.me/twitch/uptime/${encodeURIComponent(user)}`;

/** Default poll interval. */
export const DEFAULT_POLL_MS = 60_000;

/** Hard cap on parallel fetches per platform. */
const MAX_PARALLEL_FETCHES = 4;

/**
 * State: Map<creatorId, { twitch: Snap, youtube: Snap, tiktok: Snap }>
 * where Snap = { isLive: boolean, lastChecked: number, handle: string | null }
 */
const status = new Map();
const listeners = new Set();
let timerId = null;

/* ============================================================
   Built-in providers
   ============================================================ */

/**
 * Twitch live check via decapi.me. Returns true if the channel is live.
 * Any network error / non-OK / unrecognized body → false (never a lie).
 */
export async function decapiProvider(twitchUsername, fetchImpl = fetch) {
  try {
    const res = await fetchImpl(DECAPI_UPTIME(twitchUsername));
    if (!res.ok) return false;
    const text = (await res.text()).trim();
    return parseDecapiUptime(text);
  } catch {
    return false;
  }
}

/**
 * Pure parser for decapi uptime responses. Exported for tests.
 *   "2 hours, 15 minutes"          → true
 *   "senseitalon is offline"       → false
 *   ""                             → false
 *   "User not found"               → false
 */
export function parseDecapiUptime(text) {
  if (typeof text !== 'string') return false;
  const lower = text.toLowerCase();
  if (lower.includes('offline')) return false;
  if (lower.includes('not found')) return false;
  if (lower.includes('error')) return false;
  if (lower.includes('unknown user')) return false;
  return /^\d/.test(text);   // live uptime strings always start with a digit
}

/** Default placeholder for YouTube — always returns false until a real provider is wired. */
export const youtubeNoopProvider = async () => false;

/**
 * How long one /live snapshot is reused. This exists to coalesce the burst
 * of per-creator calls inside a SINGLE poll cycle into one request, not to
 * cache across cycles — so it must stay well below DEFAULT_POLL_MS. The
 * whole burst lands within milliseconds of itself; 5s is generous.
 */
const YT_SNAPSHOT_TTL_MS = 5_000;

/**
 * Build a YouTube provider backed by the Worker's /live endpoint.
 *
 * The poller calls providers one (creator, platform) pair at a time, but
 * asking the Worker to scrape one ~1MB page per request would mean 13
 * requests every poll cycle. So this closure inverts it: the first handle
 * to ask triggers ONE batched request for every handle, and the rest of
 * the burst awaits that same promise. 13 calls in, 1 request out.
 *
 *   liveStatus.start(CREATORS, {
 *     providers: {
 *       youtube: createYouTubeProvider({
 *         baseUrl: 'https://wandercraft-youtube-feed.you.workers.dev',
 *         handles: CREATORS.map((c) => c.youtubeHandle).filter(Boolean),
 *       }),
 *     },
 *   });
 *
 * Falls back to the noop provider when there's no baseUrl or no handles,
 * so an unconfigured site degrades to "nobody is live on YouTube" rather
 * than hammering a URL that doesn't exist.
 */
export function createYouTubeProvider(opts = {}) {
  return createBatchedProvider({ ...opts, platform: 'youtube' });
}

/**
 * Build a TikTok provider backed by the same Worker /live endpoint.
 *
 * Identical batching contract to YouTube — see createBatchedProvider. The
 * platform differences (which URL to scrape, which User-Agent to send,
 * how to read the response) all live server-side in the Worker, so the
 * client just names the platform.
 *
 *   liveStatus.start(CREATORS, {
 *     providers: {
 *       tiktok: createTikTokProvider({
 *         baseUrl: LIVE_WORKER_BASE_URL,
 *         handles: CREATORS.map((c) => c.tiktokHandle).filter(Boolean),
 *       }),
 *     },
 *   });
 */
export function createTikTokProvider(opts = {}) {
  return createBatchedProvider({ ...opts, platform: 'tiktok' });
}

/**
 * Shared engine behind the YouTube and TikTok providers.
 *
 * The poller calls providers one (creator, platform) pair at a time, but
 * asking the Worker to scrape one page per request would mean a dozen-plus
 * requests every poll cycle. So this closure inverts it: the first handle
 * to ask triggers ONE batched request for every handle on that platform,
 * and the rest of the burst awaits the same promise. N calls in, 1 out.
 *
 * Each platform gets its own closure, so YouTube and TikTok batch
 * independently and one platform's outage can't blank the other.
 *
 * Falls back to a noop provider when there's no baseUrl or no handles, so
 * an unconfigured site degrades to "nobody is live" rather than hammering
 * a URL that doesn't exist.
 */
function createBatchedProvider(opts = {}) {
  const baseUrl = (opts.baseUrl || '').replace(/\/+$/, '');
  const handles = [...new Set((opts.handles || []).filter(Boolean))];
  const ttlMs = opts.ttlMs ?? YT_SNAPSHOT_TTL_MS;
  const fetchImpl = opts.fetch || ((...args) => fetch(...args));
  const platform = opts.platform;

  if (!baseUrl || handles.length === 0) return youtubeNoopProvider;

  // { at, promise } — `promise` never rejects (see below), so a failed
  // snapshot is cached like any other and retried on the next cycle
  // instead of stampeding the Worker mid-outage.
  let snapshot = null;

  const fetchSnapshot = async () => {
    try {
      const url = `${baseUrl}/live?platform=${encodeURIComponent(platform)}`
        + `&handles=${encodeURIComponent(handles.join(','))}`;
      const res = await fetchImpl(url);
      if (!res.ok) return {};
      const body = await res.json();
      return body && typeof body === 'object' ? body : {};
    } catch {
      return {};
    }
  };

  return async function batchedLiveProvider(handle) {
    const now = Date.now();
    if (!snapshot || now - snapshot.at > ttlMs) {
      snapshot = { at: now, promise: fetchSnapshot() };
    }
    const snap = await snapshot.promise;
    // Strict true only: a missing key or a non-boolean is "not live".
    return snap[handle] === true;
  };
}

/** Default placeholder for TikTok — always returns false until a real provider is wired. */
export const tiktokNoopProvider = async () => false;

/* ============================================================
   Public API
   ============================================================ */

/**
 * Begin polling. Idempotent — calling twice does not double-poll.
 *
 *   const stop = start(CREATORS, {
 *     providers: { youtube: myWorkerYouTubeProvider },
 *   });
 *   stop();
 */
export function start(creators, opts = {}) {
  if (timerId !== null) return stop;

  const intervalMs = opts.intervalMs ?? DEFAULT_POLL_MS;
  const providers = {
    twitch:  decapiProvider,
    youtube: youtubeNoopProvider,
    tiktok:  tiktokNoopProvider,
    ...opts.providers,
  };

  // Build the work queue once: every (creator, platform) where the
  // creator actually has a handle for that platform.
  const jobs = [];
  for (const creator of creators) {
    for (const platform of PLATFORMS) {
      const handle = creator[HANDLE_FIELD[platform]];
      if (handle) jobs.push({ creator, platform, handle });
    }
  }
  if (jobs.length === 0) return stop;

  const tick = () => pollAll(jobs, providers);
  tick();   // first poll runs immediately
  timerId = setInterval(tick, intervalMs);
  return stop;
}

/** Stop polling. */
export function stop() {
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }
}

/**
 * Subscribe to status updates. Listener fires per (creatorId, platform)
 * change, not per poll. Returns unsubscribe.
 *
 *   const unsub = subscribe((creatorId, platform, snap) => { ... });
 */
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Read last known status for a (creator, platform) pair. */
export function getStatus(id, platform) {
  const row = status.get(id);
  if (!row) return { isLive: false, lastChecked: 0, handle: null };
  return row[platform] || { isLive: false, lastChecked: 0, handle: null };
}

/** True if the creator is live on any platform. */
export function anyLiveFor(id) {
  const row = status.get(id);
  if (!row) return false;
  return PLATFORMS.some((p) => row[p] && row[p].isLive);
}

/** All platforms a creator is currently live on. */
export function liveOn(id) {
  const row = status.get(id);
  if (!row) return [];
  return PLATFORMS.filter((p) => row[p] && row[p].isLive);
}

/* ============================================================
   Internal: bounded-parallel queue
   ============================================================ */
async function pollAll(jobs, providers) {
  const queue = [...jobs];
  const workers = Array.from({ length: Math.min(MAX_PARALLEL_FETCHES, queue.length) }, () =>
    worker(queue, providers),
  );
  await Promise.all(workers);
}

async function worker(queue, providers) {
  while (queue.length > 0) {
    const { creator, platform, handle } = queue.shift();
    const providerFn = providers[platform];
    const isLive = providerFn ? await providerFn(handle) : false;
    updateStatus(creator.id, platform, isLive, handle);
  }
}

function updateStatus(creatorId, platform, isLive, handle) {
  let row = status.get(creatorId);
  if (!row) {
    row = {};
    status.set(creatorId, row);
  }
  const prev = row[platform];
  const next = { isLive, lastChecked: Date.now(), handle };
  row[platform] = next;

  // Only notify on transitions (first reading or live↔offline flip).
  if (!prev || prev.isLive !== isLive) {
    for (const l of listeners) {
      try { l(creatorId, platform, next); } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[liveStatus] listener threw:', err);
      }
    }
  }
}

/** Test-only: reset internal state. */
export function __resetForTests() {
  status.clear();
  listeners.clear();
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }
}
