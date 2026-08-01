/**
 * Configuration for the static YouTube feed.
 *
 * The GitHub Action in .github/workflows/youtube-feed.yml runs hourly,
 * fetches each creator's YouTube RSS feed, and commits the result to
 * data/videos.json. The frontend just reads that file — no runtime
 * infrastructure, no API keys, no quotas.
 *
 * If the JSON is empty (file exists but contains []), or the fetch
 * fails (offline dev, missing file), the Content Dashboard falls back
 * to the static demo array in data/content.js.
 */

/**
 * Path to the static feed, relative to index.html.
 *
 * `data/` lives at the repo root next to index.html so it's served at
 * the same origin as the page — no CORS dance, no absolute URL.
 *
 * Override if you ever move the file (e.g. to a CDN).
 */
export const STATIC_FEED_PATH = 'data/videos.json';

/** Max items pulled from the feed (matches the builder's LIMIT so the full
 *  per-type set — up to 3 per creator — is available to the dashboard). */
export const INITIAL_VIDEO_COUNT = 45;

/**
 * Base URL of the deployed Cloudflare Worker that backs live status.
 *
 * (Despite this file's name, this one is shared by YouTube AND TikTok —
 * both run through the same Worker, which takes a ?platform= param.)
 *
 * Unlike the video feed above, live status can't be static: a file
 * regenerated on a cron is stale the moment someone goes live, and neither
 * platform has a CORS-friendly no-auth endpoint the browser can hit
 * directly. So the /live check runs in workers/youtube-feed/worker.js.
 *
 * Deployed and live. To redeploy after editing the Worker:
 *
 *   cd workers/youtube-feed && wrangler deploy
 *
 * Set this back to '' to switch ALL live badges off: modules/creators.js
 * then skips every provider and the pills simply never light up, with the
 * rest of the dashboard unaffected. Twitch does NOT depend on this; it
 * polls decapi.me straight from the browser.
 */
export const LIVE_WORKER_BASE_URL = 'https://wandercraft-youtube-feed.derekpunaroo.workers.dev';

/**
 * TikTok live badges — OFF until the detector's live branch is confirmed.
 *
 * Everything for TikTok is built, tested and deployed; this flag exists
 * because one specific thing could not be verified. The detector's OFFLINE
 * behaviour is measured against all 14 creator accounts. Its LIVE branch is
 * not, because no creator has streamed since it was written and a TikTok
 * LIVE room can't be conjured on demand. So the rule reads fields that are
 * provably offline-valued while offline, but nobody has watched it return
 * true for a real stream.
 *
 * The likely failure mode is a badge that never lights up, not a false
 * badge — but "likely" isn't "verified", so it stays off by default.
 *
 * TO TURN IT ON — verify first, then flip:
 *
 *   1. Wait until a creator is visibly live on TikTok.
 *   2. curl -s "<LIVE_WORKER_BASE_URL>/live?platform=tiktok&handles=<handle>"
 *   3. If that returns true, set this to true. If it returns false while
 *      they are streaming, the detector needs fixing first — compare the
 *      page against OFFLINE_FIXTURE in tests/tiktokLive.test.js to find
 *      which field actually changes.
 *
 * Flipping this does not require a Worker redeploy; /live?platform=tiktok
 * stays available for the curl check above either way. YouTube is entirely
 * unaffected by this flag.
 */
export const TIKTOK_LIVE_ENABLED = false;
