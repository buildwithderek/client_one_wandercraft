/**
 * YouTube live status — the Worker-side detector and the client-side
 * batching provider that consumes it.
 *
 * The two halves are tested together because they're one feature with one
 * contract: the Worker returns a { handle: boolean } map, and the provider
 * turns that into per-creator answers with exactly one request per cycle.
 */

import { describe, test, expect, vi, afterEach } from 'vitest';
import worker, { parseYouTubeLiveHtml } from '../workers/youtube-feed/worker.js';
import { createYouTubeProvider, youtubeNoopProvider } from '../js/modules/liveStatus.js';

/* ============================================================
   Worker: live-marker detection
   ============================================================ */

describe('parseYouTubeLiveHtml', () => {
  test('detects an active stream via isLiveNow', () => {
    const html = `<script>var ytInitialPlayerResponse = {"videoDetails":{"videoId":"abc"},
      "microformat":{"playerMicroformatRenderer":{"liveBroadcastDetails":{"isLiveNow":true}}}};</script>`;
    expect(parseYouTubeLiveHtml(html)).toBe(true);
  });

  test('detects an active stream via hlsManifestUrl + isLive', () => {
    const html = `<script>{"streamingData":{"hlsManifestUrl":"https://x.googlevideo.com/y.m3u8"},
      "videoDetails":{"isLive":true}}</script>`;
    expect(parseYouTubeLiveHtml(html)).toBe(true);
  });

  test('tolerates whitespace around the JSON colon', () => {
    expect(parseYouTubeLiveHtml('{"isLiveNow" : true}')).toBe(true);
  });

  test('reports offline for a plain channel page', () => {
    const html = '<html><head><title>SomeCreator - YouTube</title></head><body>videos</body></html>';
    expect(parseYouTubeLiveHtml(html)).toBe(false);
  });

  test('reports offline when isLiveNow is explicitly false', () => {
    expect(parseYouTubeLiveHtml('{"liveBroadcastDetails":{"isLiveNow":false}}')).toBe(false);
  });

  // The regression this endpoint would most plausibly ship with: every VOD
  // that was ever streamed carries isLiveContent:true forever.
  test('does NOT treat isLiveContent as live', () => {
    const html = `{"videoDetails":{"isLiveContent":true,"isLive":false},
      "streamingData":{"hlsManifestUrl":"https://x/y.m3u8"}}`;
    expect(parseYouTubeLiveHtml(html)).toBe(false);
  });

  // Scheduled streams and premieres carry live metadata before they start.
  test('does NOT treat an upcoming stream as live', () => {
    const html = `{"videoDetails":{"isUpcoming":true,"isLive":true},
      "streamingData":{"hlsManifestUrl":"https://x/y.m3u8"},
      "liveBroadcastDetails":{"isLiveNow":true}}`;
    expect(parseYouTubeLiveHtml(html)).toBe(false);
  });

  test('requires the manifest — isLive alone is not enough', () => {
    expect(parseYouTubeLiveHtml('{"videoDetails":{"isLive":true}}')).toBe(false);
  });

  test('returns false on empty or non-string input', () => {
    expect(parseYouTubeLiveHtml('')).toBe(false);
    expect(parseYouTubeLiveHtml(null)).toBe(false);
    expect(parseYouTubeLiveHtml(undefined)).toBe(false);
    expect(parseYouTubeLiveHtml(42)).toBe(false);
  });
});

/* ============================================================
   Worker: the /live endpoint itself
   ============================================================ */

describe('Worker /live', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = realFetch; });

  const LIVE_HTML = '{"liveBroadcastDetails":{"isLiveNow":true}}';
  const OFFLINE_HTML = '<html><title>channel</title></html>';

  /** Stub upstream YouTube. `live` is the set of handles that are streaming. */
  function stubYouTube(live = [], { fail = [] } = {}) {
    const urls = [];
    globalThis.fetch = vi.fn(async (url) => {
      urls.push(url);
      if (fail.some((h) => url.includes(h))) throw new Error('upstream down');
      const isLive = live.some((h) => url.includes(`/@${h}/`) || url.includes(`/${h}/`));
      return { ok: true, text: async () => (isLive ? LIVE_HTML : OFFLINE_HTML) };
    });
    globalThis.fetch.urls = urls;
    return globalThis.fetch;
  }

  const call = (path) => worker.fetch(new Request(`https://w.dev${path}`));

  test('returns a boolean for every requested handle', async () => {
    stubYouTube(['aaa']);
    const res = await call('/live?handles=aaa,bbb');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ aaa: true, bbb: false });
  });

  test('one upstream fetch per handle', async () => {
    const f = stubYouTube([]);
    await call('/live?handles=aaa,bbb,ccc');
    expect(f).toHaveBeenCalledTimes(3);
  });

  test('a failing handle reports false instead of dropping out of the map', async () => {
    stubYouTube(['aaa'], { fail: ['bbb'] });
    expect(await (await call('/live?handles=aaa,bbb')).json()).toEqual({ aaa: true, bbb: false });
  });

  test('tolerates a leading @ on handles', async () => {
    stubYouTube(['aaa']);
    expect(await (await call('/live?handles=@aaa')).json()).toEqual({ aaa: true });
  });

  test('routes a UC channel ID to /channel/, not /@', async () => {
    const f = stubYouTube([]);
    await call('/live?handles=UCg969guBVdvlhqzegxPS_tg');
    expect(f.urls[0]).toBe('https://www.youtube.com/channel/UCg969guBVdvlhqzegxPS_tg/live');
  });

  test('routes a plain handle to /@', async () => {
    const f = stubYouTube([]);
    await call('/live?handles=SenseiTalon');
    expect(f.urls[0]).toBe('https://www.youtube.com/@SenseiTalon/live');
  });

  test('caps fan-out at 25 handles', async () => {
    const f = stubYouTube([]);
    const many = Array.from({ length: 40 }, (_, i) => `h${i}`).join(',');
    await call(`/live?handles=${many}`);
    expect(f).toHaveBeenCalledTimes(25);
  });

  test('400s when no handles are supplied', async () => {
    stubYouTube([]);
    expect((await call('/live')).status).toBe(400);
    expect((await call('/live?handles=')).status).toBe(400);
  });

  test('sends CORS headers and a short cache window', async () => {
    stubYouTube([]);
    const res = await call('/live?handles=aaa');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=60');
  });

  test('does not disturb the existing /videos route', async () => {
    stubYouTube([]);
    expect((await call('/videos')).status).toBe(400);   // still "no channels supplied"
    expect((await call('/health')).status).toBe(200);
    expect((await call('/nope')).status).toBe(404);
  });
});

/* ============================================================
   Client: batching provider
   ============================================================ */

describe('createYouTubeProvider', () => {
  /** Fake fetch returning `body` as JSON, recording every URL it was given. */
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
    handles: ['aaa', 'bbb'],
    fetch: fetchImpl,
    ...extra,
  });

  test('resolves each handle from the batched map', async () => {
    const provider = createYouTubeProvider(opts(fakeFetch({ aaa: true, bbb: false })));
    expect(await provider('aaa')).toBe(true);
    expect(await provider('bbb')).toBe(false);
  });

  test('coalesces a burst of calls into ONE request', async () => {
    const fetchImpl = fakeFetch({ aaa: true, bbb: true });
    const provider = createYouTubeProvider(opts(fetchImpl));
    // Concurrent, as the poller's parallel workers would issue them.
    await Promise.all([provider('aaa'), provider('bbb'), provider('aaa')]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test('requests every handle in one query string', async () => {
    const fetchImpl = fakeFetch({});
    const provider = createYouTubeProvider(opts(fetchImpl));
    await provider('aaa');
    expect(fetchImpl.urls[0]).toBe('https://worker.example.dev/live?handles=aaa%2Cbbb');
  });

  test('re-fetches once the snapshot TTL has passed', async () => {
    const fetchImpl = fakeFetch({ aaa: true });
    const provider = createYouTubeProvider(opts(fetchImpl, { ttlMs: 20 }));
    await provider('aaa');
    await new Promise((r) => setTimeout(r, 40));
    await provider('aaa');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  test('strips a trailing slash from baseUrl', async () => {
    const fetchImpl = fakeFetch({});
    const provider = createYouTubeProvider(
      opts(fetchImpl, { baseUrl: 'https://worker.example.dev/' }),
    );
    await provider('aaa');
    expect(fetchImpl.urls[0]).toContain('.dev/live?handles=');
  });

  test('de-duplicates repeated handles', async () => {
    const fetchImpl = fakeFetch({});
    const provider = createYouTubeProvider(opts(fetchImpl, { handles: ['aaa', 'aaa', 'bbb'] }));
    await provider('aaa');
    expect(fetchImpl.urls[0]).toBe('https://worker.example.dev/live?handles=aaa%2Cbbb');
  });

  /* ---- never lie about being live ---- */

  test('reports offline for a handle missing from the response', async () => {
    const provider = createYouTubeProvider(opts(fakeFetch({ aaa: true })));
    expect(await provider('bbb')).toBe(false);
  });

  test('reports offline for a non-boolean truthy value', async () => {
    const provider = createYouTubeProvider(opts(fakeFetch({ aaa: 'yes' })));
    expect(await provider('aaa')).toBe(false);
  });

  test('reports offline on a non-OK response', async () => {
    const provider = createYouTubeProvider(opts(fakeFetch({ aaa: true }, { ok: false })));
    expect(await provider('aaa')).toBe(false);
  });

  test('reports offline when fetch throws', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('network down'); });
    const provider = createYouTubeProvider(opts(fetchImpl));
    expect(await provider('aaa')).toBe(false);
  });

  test('reports offline when the body is not an object', async () => {
    const provider = createYouTubeProvider(opts(fakeFetch('nope')));
    expect(await provider('aaa')).toBe(false);
  });

  test('does not stampede the Worker while it is failing', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('down'); });
    const provider = createYouTubeProvider(opts(fetchImpl));
    await Promise.all([provider('aaa'), provider('bbb')]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  /* ---- unconfigured degrades to noop ---- */

  test('falls back to the noop provider without a baseUrl', () => {
    expect(createYouTubeProvider({ handles: ['aaa'] })).toBe(youtubeNoopProvider);
  });

  test('falls back to the noop provider with no handles', () => {
    expect(createYouTubeProvider({ baseUrl: 'https://worker.example.dev' }))
      .toBe(youtubeNoopProvider);
  });

  test('the noop provider never fetches', async () => {
    const fetchImpl = vi.fn();
    const provider = createYouTubeProvider({ baseUrl: '', handles: [], fetch: fetchImpl });
    expect(await provider('aaa')).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
