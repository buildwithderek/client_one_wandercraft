/**
 * SINGLE SOURCE OF TRUTH for every external URL and contact target in the app.
 *
 * If you ever say "where do I change the Discord invite?" or "where does the
 *
 * Shop button go?" — the answer is this file. Don't sprinkle URLs through
 * components; import them from here.
 *
 * The fictional creators (AtlasVoyager, etc.) don't have real channels yet, so
 * we route their socials to the platform's search page for that handle. When a
 * real channel exists, swap the value here and every link in the app updates.
 */

/** Brand contact email — fan-art submissions, store inquiries, and the footer. */
export const CONTACT_EMAIL = 'playwandercraft@gmail.com';

/**
 * Base URL for creator bio pages. Mirrors playwandercraft.com, where each
 * creator has a `/{slug}-bio` page. Override per environment if we ever host
 * bios locally.
 */
export const BIO_BASE_URL = 'https://www.playwandercraft.com';

/** Build the full bio URL for a creator id. */
export const bioUrlFor = (id) => `${BIO_BASE_URL}/${id}-bio`;

/** Twitch channel URL for a creator's live link. */
export const twitchUrlFor = (username) => `https://www.twitch.tv/${username}`;

/** YouTube channel URL. `handle` is the @-style handle without the @. */
export const youtubeUrlFor = (handle) => `https://www.youtube.com/@${handle}`;

/** Direct link to a YouTube channel's /live page — works for live streams. */
export const youtubeLiveUrlFor = (handle) => `https://www.youtube.com/@${handle}/live`;

/** TikTok channel URL. `handle` is the @-style handle without the @. */
export const tiktokUrlFor = (handle) => `https://www.tiktok.com/@${handle}`;

/** TikTok live URL. */
export const tiktokLiveUrlFor = (handle) => `https://www.tiktok.com/@${handle}/live`;

/** Mailto link with a subject line. Centralized so subjects stay consistent. */
export const mailto = (subject) =>
  `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`;

/** YouTube/TikTok/etc. search URLs for the brand. */
const ytSearch = (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

/** Official WanderCraft Discord invite. Also used by the Fan Art "Upload Art" CTA. */
export const DISCORD_INVITE = 'https://discord.gg/hEVC3P6syH';

/** Brand-level community links. Replace with real URLs when available. */
export const COMMUNITY_LINKS = {
  discord: DISCORD_INVITE,
  twitter: 'https://twitter.com/search?q=wandercraft',
  youtube: ytSearch('WanderCraft creator collective'),
};

/** Store and merch. Live Fourthwall storefront at shopwandercraft.com. */
export const STORE_LINKS = {
  /** Full storefront home. */
  fullStore: 'https://shopwandercraft.com',
};

