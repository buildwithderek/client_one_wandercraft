/**
 * Configuration for creator live status.
 *
 * Live status is runtime by necessity: it can't be a file regenerated on a
 * cron, because that file is stale the moment someone goes live. So it runs
 * through a Cloudflare Worker.
 *
 * The video feed made the opposite trade (fully static, no infrastructure)
 * and lives in feedConfig.js. The two are independent: turning live status
 * off does nothing to the video dashboard, and vice versa.
 */

/**
 * Base URL of the deployed Cloudflare Worker that backs live status.
 *
 * Shared by YouTube AND TikTok — both run through the same Worker, which
 * takes a ?platform= param.
 *
 * Neither platform has a CORS-friendly no-auth endpoint the browser can
 * hit directly, so the /live check runs in workers/youtube-feed/worker.js.
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
