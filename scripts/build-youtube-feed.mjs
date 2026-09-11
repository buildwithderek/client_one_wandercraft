/**
 * WanderCraft — YouTube content feed builder (per-type)
 * =====================================================
 *
 * Goal: for every creator with a youtubeChannelId, pull their THREE most
 * recent items BY TYPE and tag each one correctly:
 *
 *   - latest regular upload   → type: 'videos'   (the /videos tab)
 *   - latest live stream      → type: 'streams'  (the /streams tab)
 *   - latest short            → type: 'shorts'   (the /shorts tab)
 *
 * Why tabs instead of RSS:
 *   YouTube's RSS feed (videos.xml) lists recent uploads but has NO signal for
 *   whether a video is/was a live stream — both use /watch?v= links. So streams
 *   would be miscategorized as videos. The channel tab pages DO separate the
 *   three types, so we read those. No API key, no quota.
 *
 * Dates — and why they must never be invented:
 *   The /videos and /streams tabs expose a relative time ("3 months ago"); the
 *   /shorts tab exposes no date at all. RSS carries exact dates but only for a
 *   channel's ~15 newest uploads, and it is rate-limited from datacenter IPs,
 *   so from inside GitHub Actions it fails intermittently.
 *
 *   The dashboard sorts by publishedAt, so a wrong date is not cosmetic: a
 *   short stamped with the run time pins itself to the top of the homepage
 *   above genuinely new uploads. The resolution order is therefore
 *
 *     1. exact date from RSS                    (authoritative)
 *     2. the date we already have on file       (stable across runs)
 *     3. an approximation from "N months ago"   (first sighting only)
 *     4. null                                   (shown with no date, sorted last)
 *
 *   Step 2 is what keeps a date from drifting: once an ID has a date, it is
 *   only ever replaced by an exact one. "Now" is never a valid answer.
 *
 * Resilience: every fetch is fail-soft. A channel (or one of its tabs) that
 * errors is skipped — partial output beats failing the whole job — but every
 * degradation is logged, and a run where most RSS lookups failed raises a
 * GitHub Actions warning annotation so it is visible without opening logs.
 *
 * Output shape (consumed by js/modules/youtubeFeed.js):
 *   [{ id, title, channelTitle, channelId, type, publishedAt, link,
 *      thumbnail, viewCount? }, ...]
 *
 * Run locally:  node scripts/build-youtube-feed.mjs
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const OUTPUT_PATH = resolve(REPO_ROOT, 'data', 'videos.json');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
         + '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const HEADERS = { 'User-Agent': UA, 'Accept-Language': 'en-US' };
const RSS_BASE = 'https://www.youtube.com/feeds/videos.xml?channel_id=';
const CHANNEL_BASE = 'https://www.youtube.com/channel/';

const TABS = [
  { tab: 'videos',  type: 'videos' },
  { tab: 'streams', type: 'streams' },
  { tab: 'shorts',  type: 'shorts' },
];

const LIMIT = 45;          // total items to write (12 creators × up to 3 types = 36)
const CONCURRENCY = 3;     // creators in flight at once (×4 requests each)
const RSS_RETRY_DELAY_MS = 1500;

/* ============================================================
   Entry point
   ============================================================ */
async function main() {
  const { CREATORS } = await import(
    `file://${resolve(REPO_ROOT, 'js/data/creators.js')}`
  );
  const channels = CREATORS.filter((c) => c.youtubeChannelId);

  if (channels.length === 0) {
    console.log('[build-youtube-feed] No channel IDs — writing empty array.');
    await writeJson([]);
    return;
  }

  // Dates already on file. This is what stops a date from being lost or
  // drifting when RSS is unavailable for a run.
  const previousDates = await loadPreviousDates();

  console.log(`[build-youtube-feed] Pulling videos/streams/shorts for ${channels.length} creator(s)...`);
  const rssFailures = [];
  const settled = await mapLimit(channels, CONCURRENCY, (creator) =>
    buildForCreator(creator, previousDates, rssFailures));

  const items = [];
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') items.push(...r.value);
    else console.warn(`[build-youtube-feed] ${channels[i].name} failed:`, r.reason?.message || r.reason);
  });

  const out = sortNewestFirst(items).slice(0, LIMIT);
  await writeJson(out);

  const byType = out.reduce((m, v) => ((m[v.type] = (m[v.type] || 0) + 1), m), {});
  const undated = out.filter((v) => !v.publishedAt).length;
  console.log(`[build-youtube-feed] Wrote ${out.length} items`, byType,
    `from ${new Set(out.map((v) => v.channelId)).size} creators`
    + (undated ? `, ${undated} without a date` : ''));

  if (rssFailures.length) {
    const msg = `RSS date lookup failed for ${rssFailures.length}/${channels.length} creators `
              + `(${rssFailures.join(', ')}) — dates carried forward from the previous file.`;
    console.warn(`[build-youtube-feed] ${msg}`);
    // Surface it in the Actions UI when it is the majority, not just the log.
    if (rssFailures.length * 2 >= channels.length) console.log(`::warning::${msg}`);
  }
}

/** Build up to 3 entries (one per type) for a single creator. */
async function buildForCreator(creator, previousDates, rssFailures) {
  const id = creator.youtubeChannelId;
  // RSS gives exact dates for recent uploads (incl. shorts) — authoritative
  // when available, but it is the flaky leg from a datacenter IP.
  const rssDates = await fetchRssDates(id).catch((err) => {
    rssFailures.push(creator.name);
    console.warn(`[build-youtube-feed] RSS failed for ${creator.name}: ${err.message}`);
    return new Map();
  });

  const results = await Promise.allSettled(
    TABS.map(async ({ tab, type }) => {
      const item = await fetchTabLatest(id, tab, type);
      if (!item) return null;
      const publishedAt = resolvePublishedAt({
        exact: rssDates.get(item.id),
        known: previousDates.get(item.id),
        approx: relativeToISO(item.relDate),
      });
      return {
        id: item.id,
        title: item.title || '(untitled)',
        channelTitle: creator.name,
        channelId: id,
        type,
        publishedAt,
        link: type === 'shorts'
          ? `https://www.youtube.com/shorts/${item.id}`
          : `https://www.youtube.com/watch?v=${item.id}`,
        thumbnail: `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
        ...(item.views != null ? { viewCount: item.views } : {}),
      };
    }),
  );
  return results.filter((r) => r.status === 'fulfilled' && r.value).map((r) => r.value);
}

/* ============================================================
   Date resolution (pure — covered by tests/buildYoutubeFeed.test.js)
   ============================================================ */

/**
 * Pick the publish date for an item. Exact beats known beats approximate;
 * an unknown date stays null rather than being invented.
 *
 * `known` outranks `approx` on purpose: an approximation is computed from a
 * relative string against the current clock, so it moves every run. Once a
 * date is on file it is only replaced by an exact one.
 */
export function resolvePublishedAt({ exact, known, approx } = {}) {
  return exact || known || approx || null;
}

/** Newest first. Items with no date sort last and keep their relative order. */
export function sortNewestFirst(items) {
  return [...items].sort((a, b) => {
    if (!a.publishedAt && !b.publishedAt) return 0;
    if (!a.publishedAt) return 1;
    if (!b.publishedAt) return -1;
    return b.publishedAt.localeCompare(a.publishedAt);
  });
}

/** "3 months ago" / "Streamed 10 hours ago" → approximate ISO, else null. */
export function relativeToISO(text, now = Date.now()) {
  if (!text) return null;
  const m = text.replace(/^streamed\s+/i, '')
    .match(/(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const secs = { second: 1, minute: 60, hour: 3600, day: 86400,
    week: 604800, month: 2629800, year: 31557600 }[m[2].toLowerCase()];
  return new Date(now - n * secs * 1000).toISOString();
}

/** "1.2K views" / "4.4M views" / "280 views" → number, else null. */
export function parseViews(text) {
  if (!text) return null;
  const m = text.match(/([\d.]+)\s*([KMB]?)/i);
  if (!m) return null;
  const mult = { K: 1e3, M: 1e6, B: 1e9 }[(m[2] || '').toUpperCase()] || 1;
  return Math.round(parseFloat(m[1]) * mult);
}

/* ============================================================
   Channel tab scraping
   ============================================================ */

/** Fetch a channel tab and return its newest item of that type, or null. */
async function fetchTabLatest(channelId, tab, type) {
  const res = await fetch(`${CHANNEL_BASE}${channelId}/${tab}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${tab}`);
  const data = extractInitialData(await res.text());
  if (!data) return null;
  return firstGridItem(data, type);
}

/**
 * Find the channel's primary content grid (richGridRenderer) and return the
 * newest item for the requested type. Handles the modern lockupViewModel
 * (videos/streams) and shortsLockupViewModel (shorts).
 *
 * Streams caveat: YouTube redirects /streams to the channel's /videos content
 * when a channel has NEVER livestreamed, so the grid is full of regular
 * uploads. A genuine past stream's metadata reads "Streamed …", so for the
 * streams tab we only accept items carrying that marker — otherwise a
 * non-streaming channel's latest upload would be mislabeled as a stream.
 *
 * Returns null when nothing qualifies (e.g. a channel with no real streams).
 */
function firstGridItem(data, type) {
  for (const node of walk(data)) {
    const contents = node.richGridRenderer?.contents;
    if (!contents) continue;

    for (const it of contents) {
      const content = it.richItemRenderer?.content;
      if (!content) continue;

      if (type === 'shorts') {
        const sv = content.shortsLockupViewModel;
        if (!sv) continue;
        const id = sv.entityId?.replace('shorts-shelf-item-', '');
        if (!id) continue;
        return {
          id,
          title: sv.overlayMetadata?.primaryText?.content,
          relDate: null, // shorts tab carries no date; RSS or the previous file supplies it
          views: parseViews(sv.overlayMetadata?.secondaryText?.content),
        };
      }

      // videos & streams both use lockupViewModel.
      const lv = content.lockupViewModel;
      if (!lv?.contentId) continue;
      const meta = lv.metadata?.lockupMetadataViewModel;
      const rows = (meta?.metadata?.contentMetadataViewModel?.metadataRows || [])
        .flatMap((r) => (r.metadataParts || []).map((p) => p.text?.content))
        .filter(Boolean);

      // Only count it as a stream if YouTube marks it as one ("Streamed …").
      if (type === 'streams' && !rows.some((t) => /streamed/i.test(t))) continue;

      return {
        id: lv.contentId,
        title: meta?.title?.content,
        relDate: rows.find((t) => /ago$/i.test(t)) || null,
        views: parseViews(rows.find((t) => /view/i.test(t))),
      };
    }
    return null; // only the first (primary) grid matters
  }
  return null;
}

/** Pull the embedded ytInitialData JSON via brace-balancing (string-aware). */
function extractInitialData(html) {
  let i = html.indexOf('ytInitialData');
  if (i < 0) return null;
  i = html.indexOf('{', i);
  if (i < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let j = i; j < html.length; j++) {
    const c = html[j];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      try { return JSON.parse(html.slice(i, j + 1)); } catch { return null; }
    }
  }
  return null;
}

function* walk(o) {
  if (o && typeof o === 'object') {
    yield o;
    for (const k of Object.keys(o)) yield* walk(o[k]);
  }
}

/* ============================================================
   RSS (exact dates) — with retry, since this is the flaky leg
   ============================================================ */

/** Map of { videoId → ISO published } for the channel's recent uploads. */
async function fetchRssDates(channelId, attempt = 1) {
  try {
    const res = await fetch(RSS_BASE + encodeURIComponent(channelId), { headers: HEADERS });
    if (!res.ok) throw new Error(`RSS HTTP ${res.status}`);
    const xml = await res.text();
    const map = new Map();
    for (const raw of xml.split(/<entry>/i).slice(1)) {
      const id = (raw.match(/<yt:videoId>([^<]+)<\/yt:videoId>/i) || [])[1];
      const pub = (raw.match(/<published>([^<]+)<\/published>/i) || [])[1];
      if (id && pub) map.set(id, new Date(pub).toISOString());
    }
    // A well-formed feed with zero entries is a soft block page, not a channel
    // with no uploads — every creator here has published. Treat it as a miss.
    if (map.size === 0) throw new Error('RSS returned no entries');
    return map;
  } catch (err) {
    if (attempt >= 2) throw err;
    await new Promise((r) => setTimeout(r, RSS_RETRY_DELAY_MS));
    return fetchRssDates(channelId, attempt + 1);
  }
}

/* ============================================================
   Previous output + concurrency + write
   ============================================================ */

/** { videoId → publishedAt } from the file on disk, or empty on first run. */
async function loadPreviousDates() {
  try {
    const prev = JSON.parse(await readFile(OUTPUT_PATH, 'utf8'));
    const map = new Map();
    for (const v of Array.isArray(prev) ? prev : []) {
      if (v?.id && v.publishedAt) map.set(v.id, v.publishedAt);
    }
    return map;
  } catch {
    return new Map();
  }
}

/** Promise.allSettled with at most `limit` tasks in flight. */
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      try { results[i] = { status: 'fulfilled', value: await fn(items[i]) }; }
      catch (reason) { results[i] = { status: 'rejected', reason }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function writeJson(arr) {
  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(arr, null, 2) + '\n');
}

// Only run when executed directly, so the pure helpers above can be imported
// by the test suite without kicking off a scrape.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error('[build-youtube-feed] FATAL:', err);
    process.exit(1);
  });
}
