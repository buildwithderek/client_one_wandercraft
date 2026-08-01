/**
 * WanderCraft — YouTube RSS Aggregator (Cloudflare Worker)
 * =========================================================
 *
 * Fetches the public, no-auth, no-quota RSS feed for each requested
 * channel and returns a merged, sorted JSON array of recent videos.
 *
 * Why RSS? YouTube publishes each channel's most recent uploads at
 *
 *     https://www.youtube.com/feeds/videos.xml?channel_id=UCxxxx
 *
 * with NO API key, NO quota, and ~15 entries per channel. This Worker
 * is purely a CORS-friendly proxy + XML→JSON converter. If you ever
 * outgrow what RSS gives you (older videos, exact view counts, etc.),
 * swap this Worker out for the YouTube Data API version without
 * changing any frontend code — the response shape stays the same.
 *
 * --------------------------------------------------------------------
 * DEPLOYING THIS WORKER (one-time setup, ~5 minutes)
 * --------------------------------------------------------------------
 *
 * 1. Install the Cloudflare CLI:
 *      npm install -g wrangler
 *
 * 2. Log in to your Cloudflare account:
 *      wrangler login
 *
 * 3. From this directory (workers/youtube-feed/), deploy:
 *      wrangler deploy
 *
 *    Wrangler reads wrangler.toml in this same folder. After deploy
 *    it prints a URL like:
 *      https://wandercraft-youtube-feed.<your-subdomain>.workers.dev
 *
 * 4. Paste that URL into js/data/youtubeConfig.js (WORKER_BASE_URL).
 *
 * 5. Open the page, scroll to the Content Dashboard. Done — the cards
 *    are now real YouTube videos pulled live.
 *
 * --------------------------------------------------------------------
 * REQUEST FORMAT
 * --------------------------------------------------------------------
 *
 *   GET /videos?channels=UC1,UC2,UC3&limit=30
 *
 *   channels  Comma-separated list of YouTube channel IDs (UCxxxxx).
 *             Max ~50 (queries beyond that may hit the URL length limit).
 *   limit     Optional. Max items to return. Defaults to 30.
 *
 *   GET /live?handles=SenseiTalon,JvshuaLP
 *
 *   handles   Comma-separated YouTube handles WITHOUT the leading @.
 *             A UCxxxx channel ID works too — it's detected by shape and
 *             hits /channel/<id>/live instead of /@<handle>/live.
 *             Max LIVE_MAX_HANDLES (25) per request.
 *
 *   Responds with a flat map, one key per requested handle:
 *
 *     { "SenseiTalon": true, "JvshuaLP": false }
 *
 *   A handle whose fetch fails reports false rather than dropping out of
 *   the map — the badge should never claim someone is live on bad data.
 *
 * --------------------------------------------------------------------
 * RESPONSE FORMAT
 * --------------------------------------------------------------------
 *
 *   [
 *     {
 *       "id":          "abc123XYZ",
 *       "title":       "Surviving 100 Days in Arctic Iceland",
 *       "channelTitle":"AtlasVoyager",
 *       "channelId":   "UCxxxxxxxxxxx",
 *       "thumbnail":   "https://i3.ytimg.com/vi/abc123XYZ/hqdefault.jpg",
 *       "publishedAt": "2026-05-30T15:22:11Z",
 *       "link":        "https://www.youtube.com/watch?v=abc123XYZ",
 *       "viewCount":   2143829   // best-effort; missing on some feeds
 *     },
 *     ...
 *   ]
 *
 * Sorted by publishedAt descending. If individual channel fetches fail
 * they're silently skipped — partial results beat a 500.
 *
 * --------------------------------------------------------------------
 * CACHING
 * --------------------------------------------------------------------
 *
 * Cloudflare's edge cache holds responses for `CACHE_TTL_SECONDS`
 * (default 10 min). Channels are fetched with `cf: { cacheTtl: ... }`
 * so the same RSS feed isn't re-fetched on every Worker request.
 * YouTube's RSS endpoint serves stale cached XML quickly — totally
 * fine for "most-recent uploads."
 */

const CACHE_TTL_SECONDS = 600;        // 10 minutes
const DEFAULT_LIMIT = 30;
const YT_RSS_BASE = 'https://www.youtube.com/feeds/videos.xml?channel_id=';

/* ---- /live tuning ------------------------------------------------
   Live pages are ~1MB of HTML each, so this endpoint is far heavier
   than /videos. Three things keep it cheap:
     - a 60s edge cache (live status doesn't need to be fresher than
       the frontend's poll interval)
     - a bounded fetch pool, so 25 handles don't open 25 sockets
     - a handle cap, so a malformed query can't fan out unboundedly
   ------------------------------------------------------------------ */
const LIVE_CACHE_TTL_SECONDS = 60;
const LIVE_MAX_HANDLES = 25;
const LIVE_MAX_PARALLEL = 4;
const YT_CHANNEL_ID_RE = /^UC[\w-]{22}$/;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request) {
    // Pre-flight check for browsers.
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (request.method !== 'GET') {
      return json({ error: 'Method not allowed' }, 405);
    }

    const url = new URL(request.url);

    // Health check at root.
    if (url.pathname === '/' || url.pathname === '/health') {
      return json({ ok: true, service: 'wandercraft-youtube-feed' });
    }

    if (url.pathname === '/live') {
      return handleLive(url);
    }

    if (url.pathname !== '/videos') {
      return json({ error: 'Not found' }, 404);
    }

    const channelsParam = url.searchParams.get('channels') || '';
    const channels = channelsParam
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (channels.length === 0) {
      return json({ error: 'No channels supplied. Pass ?channels=UC1,UC2,...' }, 400);
    }

    const limit = Math.min(
      parseInt(url.searchParams.get('limit'), 10) || DEFAULT_LIMIT,
      200,
    );

    // Fetch every channel feed in parallel. Failures are tolerated:
    // missing channels just contribute zero videos.
    const settled = await Promise.allSettled(channels.map(fetchChannelFeed));
    const videos = [];
    for (const result of settled) {
      if (result.status === 'fulfilled') videos.push(...result.value);
    }

    // Merge, sort newest-first, trim to limit.
    videos.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    const sliced = videos.slice(0, limit);

    return json(sliced);
  },
};

/* ============================================================
   Per-channel fetch + parse
   ============================================================ */

async function fetchChannelFeed(channelId) {
  const res = await fetch(YT_RSS_BASE + encodeURIComponent(channelId), {
    cf: { cacheTtl: CACHE_TTL_SECONDS, cacheEverything: true },
  });
  if (!res.ok) return [];
  const xml = await res.text();
  return parseAtomFeed(xml);
}

/**
 * Tiny regex-based Atom parser.
 *
 * The YouTube feed is small (~15 entries, ~30KB) and well-formed, so we
 * skip pulling in a full XML library. If YouTube ever changes the feed
 * structure this will need updating — but the format has been stable
 * since 2015.
 *
 * Tags we extract per <entry>:
 *   <yt:videoId>       → id
 *   <title>            → title
 *   <author><name>     → channelTitle
 *   <yt:channelId>     → channelId
 *   <published>        → publishedAt
 *   <link rel=...>     → link
 *   <media:thumbnail>  → thumbnail
 *   <media:statistics views="..." />  → viewCount (best-effort)
 */
function parseAtomFeed(xml) {
  const entries = xml.split(/<entry>/i).slice(1);   // discard everything before first <entry>
  const videos = [];

  for (const raw of entries) {
    const entry = raw.split(/<\/entry>/i)[0];
    if (!entry) continue;

    const id            = pick(entry, /<yt:videoId>([^<]+)<\/yt:videoId>/i);
    if (!id) continue;
    const title         = decodeXml(pick(entry, /<title>([\s\S]*?)<\/title>/i));
    const channelTitle  = decodeXml(pick(entry, /<author>\s*<name>([\s\S]*?)<\/name>/i));
    const channelId     = pick(entry, /<yt:channelId>([^<]+)<\/yt:channelId>/i);
    const publishedAt   = pick(entry, /<published>([^<]+)<\/published>/i);
    // Accept either single or double quotes — YouTube uses double, but
    // staying permissive makes the parser less fragile if the feed shape
    // ever shifts. `(["'])` captures the opening quote so it can be reused
    // to match the closing one with a backreference.
    const link          = pick(entry, /<link\s+[^>]*href=(["'])([^"']+)\1/i, 2);
    const thumbnail     = pick(entry, /<media:thumbnail\s+url=(["'])([^"']+)\1/i, 2);
    const viewCountRaw  = pick(entry, /<media:statistics\s+[^>]*views=(["'])(\d+)\1/i, 2);
    const viewCount     = viewCountRaw ? parseInt(viewCountRaw, 10) : undefined;

    videos.push({
      id,
      title,
      channelTitle,
      channelId,
      publishedAt,
      link,
      thumbnail: thumbnail || `https://i3.ytimg.com/vi/${id}/hqdefault.jpg`,
      ...(viewCount !== undefined ? { viewCount } : {}),
    });
  }
  return videos;
}

/**
 * Nth capture group of a regex against text, or empty string.
 * Defaults to group 1 — pass `group=2` etc. when an earlier group
 * captured a delimiter (e.g. a quote character we wanted to match).
 */
function pick(text, regex, group = 1) {
  const m = text.match(regex);
  return m ? m[group].trim() : '';
}

/** Decode the handful of XML/HTML entities YouTube emits. */
function decodeXml(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

/* ============================================================
   /live — is each channel streaming right now?
   ============================================================ */

async function handleLive(url) {
  const handles = (url.searchParams.get('handles') || '')
    .split(',')
    .map((s) => s.trim().replace(/^@/, ''))   // tolerate a leading @
    .filter(Boolean)
    .slice(0, LIVE_MAX_HANDLES);

  if (handles.length === 0) {
    return json({ error: 'No handles supplied. Pass ?handles=name1,name2,...' }, 400);
  }

  // Bounded-parallel drain, same shape as the frontend poller. Results go
  // into a map rather than an array so a slow handle can't reorder them.
  const queue = [...handles];
  const result = {};
  const workers = Array.from(
    { length: Math.min(LIVE_MAX_PARALLEL, queue.length) },
    async () => {
      while (queue.length > 0) {
        const handle = queue.shift();
        result[handle] = await isChannelLive(handle);
      }
    },
  );
  await Promise.all(workers);

  return json(result, 200, LIVE_CACHE_TTL_SECONDS);
}

/**
 * Fetch a channel's /live page and decide whether it's streaming.
 *
 * YouTube serves /@handle/live as the watch page for the active stream
 * when there is one, and as a plain channel page when there isn't. No
 * API key, no quota — same trade as the RSS feed above.
 *
 * Any failure (network, non-OK, redirect to a consent wall) resolves to
 * false. An offline badge on a live streamer is a cosmetic miss; a live
 * badge on an offline streamer sends viewers to a dead link.
 */
async function isChannelLive(handle) {
  try {
    const path = YT_CHANNEL_ID_RE.test(handle)
      ? `channel/${encodeURIComponent(handle)}`
      : `@${encodeURIComponent(handle)}`;
    const res = await fetch(`https://www.youtube.com/${path}/live`, {
      // A real UA matters: YouTube serves a stripped page to unknown
      // clients, and the stripped page has none of the live markers.
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WanderCraftBot/1.0; +https://playwandercraft.com)',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      cf: { cacheTtl: LIVE_CACHE_TTL_SECONDS, cacheEverything: true },
    });
    if (!res.ok) return false;
    return parseYouTubeLiveHtml(await res.text());
  } catch {
    return false;
  }
}

/**
 * Pure detector for the live markers in a YouTube watch/channel page.
 * Exported for tests — this is the fragile part of the endpoint, since
 * it depends on YouTube's embedded player JSON.
 *
 * Order matters. Checked in sequence:
 *
 *   1. "isUpcoming":true — a scheduled stream or premiere that hasn't
 *      started. These pages DO carry live metadata, so this has to be
 *      ruled out before anything else or every countdown reads as live.
 *   2. "isLiveNow":true — liveBroadcastDetails. This is the signal that
 *      actually fires in production: verified against a 24/7 stream
 *      (@LofiGirl → true) and an idle channel (@SenseiTalon → false).
 *   3. hlsManifestUrl + "isLive":true — a dormant safety net. YouTube
 *      does NOT include streamingData for our bot User-Agent, so this
 *      branch never fires today; it's here to catch the case where a
 *      UA or rendering change drops liveBroadcastDetails instead. Both
 *      markers are required together because "isLive":true alone also
 *      appears on channel pages that merely *shelve* someone else's
 *      live video.
 *
 * The closing quote in `"isLive"` is load-bearing: videoDetails also
 * carries "isLiveContent":true, which is true for any VOD that was ever
 * a livestream. Matching that would mark a channel live forever after
 * its first stream.
 */
export function parseYouTubeLiveHtml(html) {
  if (typeof html !== 'string' || html.length === 0) return false;
  if (/"isUpcoming"\s*:\s*true/.test(html)) return false;
  if (/"isLiveNow"\s*:\s*true/.test(html)) return true;
  if (/hlsManifestUrl/.test(html) && /"isLive"\s*:\s*true/.test(html)) return true;
  return false;
}

/* ============================================================
   Helpers
   ============================================================ */
function json(body, status = 200, maxAge = CACHE_TTL_SECONDS) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Browser cache the same as edge cache, so repeated reloads
      // don't repoll the Worker.
      'Cache-Control': `public, max-age=${maxAge}`,
      ...CORS_HEADERS,
    },
  });
}
