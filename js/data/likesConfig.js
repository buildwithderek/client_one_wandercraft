/**
 * Configuration for shared fan-art like counts.
 *
 * Likes need a server: before this, a like lived in the visitor's own
 * localStorage, so it survived a reload but nobody else ever saw it and every
 * count on the site read zero. The counter is a small Cloudflare Worker backed
 * by KV — see workers/fanart-likes/.
 *
 * Set to '' to turn the backend off. The gallery then falls back to the old
 * per-browser behaviour rather than breaking: hearts still toggle and still
 * persist on that device, they just stop being shared.
 */
export const LIKES_API_URL = 'https://wandercraft-fanart-likes.derekpunaroo.workers.dev/likes';

/** How long to wait on the counter before giving up and rendering local state. */
export const LIKES_TIMEOUT_MS = 4000;
