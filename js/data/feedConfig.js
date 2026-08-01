/**
 * Configuration for the static video feed.
 *
 * The feed is deliberately static: a GitHub Action regenerates
 * data/videos.json on a schedule and the frontend just reads the file.
 * No runtime infrastructure, no API keys, no quotas.
 *
 * Live status made the opposite trade (it can't be static — a file
 * regenerated on a cron is stale the moment someone goes live) and lives
 * in liveConfig.js. The two are independent: turning live status off does
 * nothing to the video dashboard, and vice versa.
 */

/**
 * Path to the static feed, relative to index.html.
 *
 * The GitHub Action in .github/workflows/youtube-feed.yml runs hourly,
 * fetches each creator's YouTube RSS feed, and commits the result here.
 *
 * If the JSON is empty (file exists but contains []), or the fetch fails
 * (offline dev, missing file), the Content Dashboard falls back to the
 * static demo array in data/content.js.
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
