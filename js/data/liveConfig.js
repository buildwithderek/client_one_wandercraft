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
 * TikTok live badges — ON, with one caveat worth knowing.
 *
 * The detector's OFFLINE behaviour is measured: all 14 creator accounts
 * were fetched from the deployed Worker and every one produced the same
 * offline fingerprint. Its LIVE branch has never been observed returning
 * true for a real stream, because no creator has been live on TikTok while
 * anyone was watching, and a LIVE room can't be conjured on demand. The
 * rule reads fields that are provably offline-valued while offline, so the
 * realistic failure is a badge that never lights up — not a false badge on
 * someone who isn't streaming.
 *
 * That's why this was parked initially. It was turned on as a deliberate
 * call to accept the assumption rather than wait indefinitely.
 *
 * WHAT TO WATCH FOR — the first time a creator is visibly live on TikTok:
 *
 *   curl -s "<LIVE_WORKER_BASE_URL>/live?platform=tiktok&handles=<handle>"
 *
 *   true   → the live branch is confirmed; delete this caveat.
 *   false  → the detector is reading the wrong field. Capture their page
 *            and diff it against OFFLINE_FIXTURE in tests/tiktokLive.test.js;
 *            whichever field differs is the one to read.
 *
 * Set this to false to park it again — pills revert to ordinary channel
 * links. No Worker redeploy needed either way, and YouTube is entirely
 * unaffected by this flag.
 */
export const TIKTOK_LIVE_ENABLED = true;
