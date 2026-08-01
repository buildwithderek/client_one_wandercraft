/**
 * TikTok live status — the Worker-side detector and the client provider.
 *
 * READ THIS BEFORE TRUSTING A GREEN RUN
 * =====================================
 * The OFFLINE branch here is backed by real measurement: all 14 creator
 * accounts were fetched from the deployed Worker and every one produced
 * the identical fingerprint asserted in OFFLINE_FIXTURE below.
 *
 * The LIVE branch is NOT. No creator has streamed since this was written,
 * and a TikTok LIVE room can't be conjured on demand, so LIVE_FIXTURE is
 * constructed from the schema rather than captured from a real stream.
 * The detector is deliberately shaped so that being wrong means a badge
 * that never lights up, not one that lights up falsely.
 *
 * To confirm the live branch the first time a creator goes live:
 *
 *   curl -s "$WORKER/live?platform=tiktok&handles=<their-handle>"
 *
 * If that returns false while they are visibly streaming, capture the page
 * and compare against OFFLINE_FIXTURE — the field that differs is the one
 * this detector should be reading.
 */

import { describe, test, expect, vi, afterEach } from 'vitest';
import worker, { parseTikTokLiveHtml } from '../workers/youtube-feed/worker.js';
import { createTikTokProvider, youtubeNoopProvider } from '../js/modules/liveStatus.js';

/**
 * Condensed from a real fetch of an idle creator account. Every field
 * below appeared verbatim, including the two decoys: the USER object's
 * own "status":4 (account state, not live state) and its non-empty
 * "roomId" (a leftover from their last stream).
 */
const OFFLINE_FIXTURE = `<script id="SIGI_STATE" type="application/json">{
  "LiveRoom":{"isAgeGateRoom":false,"recommendLiveRooms":[],"liveRoomStatus":0,
    "liveRoomUserInfo":{"user":{"uniqueId":"senseitalon_","verified":false,
      "roomId":"7667438865707174687","status":4,"followStatus":0},
      "liveRoom":{"title":"LAST DAY OF WANDERCRAFT SEASON 2","startTime":1785214815,"status":4}}},
  "CurrentRoom":{"roomInfo":null,"anchorId":"","roomId":"","liveType":"video_live"}
}</script>`;

/** Same shape with the two offline-valued fields flipped to a live room. */
const LIVE_FIXTURE = OFFLINE_FIXTURE
  .replace('"liveRoomStatus":0', '"liveRoomStatus":2')
  .replace('"CurrentRoom":{"roomInfo":null,"anchorId":"","roomId":""',
           '"CurrentRoom":{"roomInfo":{},"anchorId":"123","roomId":"7667438865707174687"');

/* ============================================================
   Worker: live-marker detection
   ============================================================ */

describe('parseTikTokLiveHtml', () => {
  test('reports offline for the measured idle-account fingerprint', () => {
    expect(parseTikTokLiveHtml(OFFLINE_FIXTURE)).toBe(false);
  });

  test('detects a live room', () => {
    expect(parseTikTokLiveHtml(LIVE_FIXTURE)).toBe(true);
  });

  test('CurrentRoom.roomId alone is enough', () => {
    const html = `<script id="SIGI_STATE">{"CurrentRoom":{"anchorId":"1","roomId":"7667438865707174687"}}</script>`;
    expect(parseTikTokLiveHtml(html)).toBe(true);
  });

  test('a non-zero liveRoomStatus alone is enough', () => {
    const html = '<script id="SIGI_STATE">{"liveRoomStatus":2,"CurrentRoom":{"roomId":""}}</script>';
    expect(parseTikTokLiveHtml(html)).toBe(true);
  });

  /* ---- the two decoys that make a naive detector wrong ---- */

  // The user object carries its own status:4 that has nothing to do with
  // streaming. A bare /"status":4/ check reads account state.
  test('does NOT read the user object\'s status as live state', () => {
    const html = `<script id="SIGI_STATE">{"uniqueId":"x","verified":false,"status":2,
      "liveRoomStatus":0,"CurrentRoom":{"roomId":""}}</script>`;
    expect(parseTikTokLiveHtml(html)).toBe(false);
  });

  // The user object's roomId stays populated after a stream ends. Only
  // CurrentRoom.roomId empties out.
  test('does NOT treat the user object\'s leftover roomId as live', () => {
    const html = `<script id="SIGI_STATE">{"uniqueId":"x","verified":false,
      "roomId":"7667438865707174687","liveRoomStatus":0,"CurrentRoom":{"roomId":""}}</script>`;
    expect(parseTikTokLiveHtml(html)).toBe(false);
  });

  /* ---- degraded renders must read as offline, not as unknown ---- */

  // Measured: a bot User-Agent gets a page with no SIGI_STATE at all.
  // Without the guard this is indistinguishable from a parse failure.
  test('reports offline for a stripped bot-UA render', () => {
    const html = '<html><head><title></title></head><body>__UNIVERSAL_DATA__</body></html>';
    expect(parseTikTokLiveHtml(html)).toBe(false);
  });

  test('reports offline for a captcha/verification wall', () => {
    expect(parseTikTokLiveHtml('<html><body>Verify to continue</body></html>')).toBe(false);
  });

  test('returns false on empty or non-string input', () => {
    expect(parseTikTokLiveHtml('')).toBe(false);
    expect(parseTikTokLiveHtml(null)).toBe(false);
    expect(parseTikTokLiveHtml(undefined)).toBe(false);
    expect(parseTikTokLiveHtml(42)).toBe(false);
  });
});

/* ============================================================
   Worker: /live?platform=tiktok routing
   ============================================================ */

describe('Worker /live?platform=tiktok', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = realFetch; });

  function stubTikTok(live = []) {
    const seen = [];
    globalThis.fetch = vi.fn(async (url, init) => {
      seen.push({ url, ua: init?.headers?.['User-Agent'] });
      const isLive = live.some((h) => url.includes(`/@${h}/`));
      return { ok: true, text: async () => (isLive ? LIVE_FIXTURE : OFFLINE_FIXTURE) };
    });
    globalThis.fetch.seen = seen;
    return globalThis.fetch;
  }

  const call = (path) => worker.fetch(new Request(`https://w.dev${path}`));

  test('returns a boolean per handle', async () => {
    stubTikTok(['zuuttz']);
    const res = await call('/live?platform=tiktok&handles=zuuttz,sklump_');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ zuuttz: true, sklump_: false });
  });

  test('hits the TikTok live URL, not YouTube', async () => {
    const f = stubTikTok([]);
    await call('/live?platform=tiktok&handles=zuuttz');
    expect(f.seen[0].url).toBe('https://www.tiktok.com/@zuuttz/live');
  });

  // Measured: a bot UA gets a stripped page with no live-room state, so
  // every creator would read as permanently offline.
  test('sends a browser User-Agent to TikTok', async () => {
    const f = stubTikTok([]);
    await call('/live?platform=tiktok&handles=zuuttz');
    expect(f.seen[0].ua).toMatch(/Mozilla\/5\.0 \(Macintosh/);
    expect(f.seen[0].ua).not.toMatch(/WanderCraftBot/);
  });

  test('still sends the bot UA to YouTube', async () => {
    const f = stubTikTok([]);
    await call('/live?platform=tiktok&handles=x');
    const ttUa = f.seen[0].ua;
    stubTikTok([]);
    await call('/live?handles=x');
    expect(globalThis.fetch.seen[0].ua).toMatch(/WanderCraftBot/);
    expect(globalThis.fetch.seen[0].ua).not.toBe(ttUa);
  });

  test('defaults to youtube when platform is omitted', async () => {
    const f = stubTikTok([]);
    await call('/live?handles=SomeChannel');
    expect(f.seen[0].url).toBe('https://www.youtube.com/@SomeChannel/live');
  });

  test('400s on an unknown platform', async () => {
    stubTikTok([]);
    const res = await call('/live?platform=myspace&handles=x');
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Unknown platform/);
  });

  test('caps fan-out at 25 handles', async () => {
    const f = stubTikTok([]);
    const many = Array.from({ length: 40 }, (_, i) => `h${i}`).join(',');
    await call(`/live?platform=tiktok&handles=${many}`);
    expect(f).toHaveBeenCalledTimes(25);
  });
});

/* ============================================================
   Client: the TikTok provider
   ============================================================ */

describe('createTikTokProvider', () => {
  function fakeFetch(body, { ok = true } = {}) {
    const urls = [];
    const fn = vi.fn(async (url) => {
      urls.push(url);
      return { ok, json: async () => body };
    });
    fn.urls = urls;
    return fn;
  }

  const opts = (fetchImpl, extra = {}) => ({
    baseUrl: 'https://worker.example.dev',
    handles: ['zuuttz', 'sklump_'],
    fetch: fetchImpl,
    ...extra,
  });

  test('resolves each handle from the batched map', async () => {
    const provider = createTikTokProvider(opts(fakeFetch({ zuuttz: true, sklump_: false })));
    expect(await provider('zuuttz')).toBe(true);
    expect(await provider('sklump_')).toBe(false);
  });

  test('asks the Worker for the tiktok platform', async () => {
    const fetchImpl = fakeFetch({});
    const provider = createTikTokProvider(opts(fetchImpl));
    await provider('zuuttz');
    expect(fetchImpl.urls[0]).toBe(
      'https://worker.example.dev/live?platform=tiktok&handles=zuuttz%2Csklump_',
    );
  });

  test('coalesces a burst into ONE request', async () => {
    const fetchImpl = fakeFetch({ zuuttz: true });
    const provider = createTikTokProvider(opts(fetchImpl));
    await Promise.all([provider('zuuttz'), provider('sklump_'), provider('zuuttz')]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test('reports offline for a handle missing from the response', async () => {
    const provider = createTikTokProvider(opts(fakeFetch({ zuuttz: true })));
    expect(await provider('sklump_')).toBe(false);
  });

  test('reports offline when the Worker fails', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('down'); });
    const provider = createTikTokProvider(opts(fetchImpl));
    expect(await provider('zuuttz')).toBe(false);
  });

  test('falls back to noop when unconfigured', () => {
    expect(createTikTokProvider({ handles: ['zuuttz'] })).toBe(youtubeNoopProvider);
    expect(createTikTokProvider({ baseUrl: 'https://w.dev' })).toBe(youtubeNoopProvider);
  });
});

/* ============================================================
   The two platforms must not share a batch
   ============================================================ */

describe('platform isolation', () => {
  test('YouTube and TikTok batch independently', async () => {
    const { createYouTubeProvider } = await import('../js/modules/liveStatus.js');
    const urls = [];
    const fetchImpl = vi.fn(async (url) => {
      urls.push(url);
      return { ok: true, json: async () => ({ shared: url.includes('tiktok') }) };
    });
    const yt = createYouTubeProvider({ baseUrl: 'https://w.dev', handles: ['shared'], fetch: fetchImpl });
    const tt = createTikTokProvider({ baseUrl: 'https://w.dev', handles: ['shared'], fetch: fetchImpl });
    // Same handle string on both platforms must not resolve from one snapshot.
    expect(await yt('shared')).toBe(false);
    expect(await tt('shared')).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(urls.filter((u) => u.includes('platform=youtube'))).toHaveLength(1);
    expect(urls.filter((u) => u.includes('platform=tiktok'))).toHaveLength(1);
  });
});
