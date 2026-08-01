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
 * TikTok live badges — OFF until the detector's live branch is verified.
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
 * This was briefly enabled, then turned back off: "the likely failure is
 * harmless" is not the same as "verified", and the badge is a claim the
 * site makes to visitors. It stays off until something confirms it.
 *
 * TO VERIFY, then enable — the first time a creator is visibly live on
 * TikTok, while they are still streaming:
 *
 *   curl -s "<LIVE_WORKER_BASE_URL>/live?platform=tiktok&handles=<handle>"
 *
 *   true   → the live branch is confirmed. Set this to true and say so
 *            here, naming the creator and roughly when.
 *   false  → the detector is reading the wrong field. Capture their page
 *            and diff it against OFFLINE_FIXTURE in tests/tiktokLive.test.js;
 *            whichever field differs is the one to read.
 *
 * Note that YouTube got exactly this confirmation (@Its_kodaaa, live on
 * 2026-08-01, Worker returned true) — so the check above is a real,
 * achievable step, not a formality that will never come.
 *
 * While off, TikTok pills render as ordinary channel links and never light
 * up. No Worker redeploy is needed either way — /live?platform=tiktok stays
 * available for the curl above — and YouTube is unaffected by this flag.
 */
export const TIKTOK_LIVE_ENABLED = false;
