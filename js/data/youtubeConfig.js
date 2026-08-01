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
 * Base URL of the deployed Cloudflare Worker that backs YouTube live status.
 *
 * Unlike the video feed above, live status can't be static: a file
 * regenerated on a cron is stale the moment someone goes live, and YouTube
 * has no CORS-friendly no-auth endpoint the browser can hit directly. So
 * the /live check runs in workers/youtube-feed/worker.js instead.
 *
 * Deployed and live. To redeploy after editing the Worker:
 *
 *   cd workers/youtube-feed && wrangler deploy
 *
 * Set this back to '' to switch YouTube live badges off: modules/creators.js
 * then skips the provider entirely and the pills simply never light up, with
 * the rest of the dashboard unaffected. Twitch does NOT depend on this; it
 * polls decapi.me straight from the browser.
 */
export const LIVE_WORKER_BASE_URL = 'https://wandercraft-youtube-feed.derekpunaroo.workers.dev';
