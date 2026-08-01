/**
 * Browser-side reader for the static YouTube feed.
 *
 * The GitHub Action regenerates data/videos.json on a cron schedule.
 * This module just fetches that file and transforms each entry into the
 * shape the content-card component already knows how to render. The
 * card code doesn't care whether the data came from a static JSON, a
 * Cloudflare Worker, or the YouTube Data API — same input shape.
 *
 * Returns `null` (rather than throwing) when:
 *   - The JSON file doesn't exist or is empty (initial deploy, no
 *     channel IDs filled in yet).
 *   - The fetch errors (offline dev, file moved).
 *
 * The caller treats null as "fall back to the static demo array."
 */

import { CREATORS } from '../data/creators.js';
import { STATIC_FEED_PATH, INITIAL_VIDEO_COUNT } from '../data/liveConfig.js';

/**
 * Fetch up to INITIAL_VIDEO_COUNT recent videos from the static feed.
 * Returns null when the feed is unavailable or empty.
 */
export async function fetchLatestVideos({ fetchImpl = fetch } = {}) {
  try {
    const res = await fetchImpl(STATIC_FEED_PATH, { cache: 'no-cache' });
    if (!res.ok) return null;
    const raw = await res.json();
    if (!Array.isArray(raw) || raw.length === 0) return null;
    return raw.slice(0, INITIAL_VIDEO_COUNT).map(toContentCardShape);
  } catch {
    return null;
  }
}

/* ============================================================
   Shape adapter — same as before. Output matches contentCard.js.
   ============================================================ */
function toContentCardShape(v) {
  const creator = CREATORS.find((c) => c.youtubeChannelId === v.channelId);
  const link = v.link || `https://www.youtube.com/watch?v=${v.id}`;
  return {
    id:        v.id,
    title:     v.title,
    creator:   v.channelTitle || (creator && creator.name) || 'WanderCraft',
    // The feed builder tags each item by type (videos | streams | shorts).
    // Fall back to URL-based detection for older entries without a type.
    type:      v.type || classifyType(link),
    views:     formatViews(v.viewCount),
    date:      formatRelativeDate(v.publishedAt),
    duration:  '',
    color:     creatorColorFor(v.channelId),
    link,
    thumbnail: v.thumbnail,
  };
}

/**
 * Fallback type detection from the URL, used only for feed entries that predate
 * the per-type builder. A YouTube /shorts/ URL (or any TikTok link, since TikTok
 * is all short-form) is a "short"; a /watch?v= URL is a long-format video.
 * (Live streams can't be told apart from a URL — the builder tags those.)
 */
function classifyType(link) {
  if (/\/shorts\//i.test(link) || /tiktok\.com/i.test(link)) return 'shorts';
  return 'videos';
}

function formatViews(n) {
  if (typeof n !== 'number' || Number.isNaN(n)) return '';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M views`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K views`;
  return `${n} views`;
}

function formatRelativeDate(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds <  60)         return 'just now';
  if (seconds <  3600)       return `${Math.floor(seconds / 60)} min ago`;
  if (seconds <  86_400)     return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds <  604_800)    return `${Math.floor(seconds / 86_400)} days ago`;
  if (seconds <  2_629_800)  return `${Math.floor(seconds / 604_800)} weeks ago`;
  return `${Math.floor(seconds / 2_629_800)} months ago`;
}

const PALETTE = ['#1B4965', '#2F6F4F', '#4CAF7D', '#FF8C42', '#D9C3A5', '#ef4444'];
function creatorColorFor(channelId) {
  if (!channelId) return PALETTE[0];
  let h = 0;
  for (const ch of channelId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
