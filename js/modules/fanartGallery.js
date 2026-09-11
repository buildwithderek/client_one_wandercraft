/**
 * Fan-art gallery: renders the top featured pieces and lets visitors like them.
 *
 * Likes are shared. The count comes from a small Cloudflare Worker backed by KV
 * (workers/fanart-likes/), so a like from one visitor is visible to everyone.
 * Before that existed a like was written only to the liker's own localStorage,
 * which meant it survived a reload but every count on the site read zero.
 *
 * localStorage still does two jobs:
 *   - which items THIS browser has liked, so the heart is filled on arrival
 *     without waiting for the network, and a second click reads as an unlike
 *   - a random visitor id, which is what stops one person double-counting
 *     across reloads and tabs
 *
 * If the counter is unreachable — offline, Worker down, LIKES_API_URL blank —
 * the gallery silently falls back to the old per-browser behaviour. Hearts
 * still toggle and still persist on that device; they just stop being shared.
 * A dead counter must never make the gallery look broken.
 *
 * The "Upload Art" CTA is a plain link to the WanderCraft Discord (see
 * index.html), so there's no JS to wire for it here.
 */

import { FAN_ART_ITEMS } from '../data/fanart.js';
import { fanArtItemHTML } from '../components/fanartItem.js';
import { observeNewElements } from './scrollReveal.js';
import { LIKES_API_URL, LIKES_TIMEOUT_MS } from '../data/likesConfig.js';

/** Only the first N items render — keeps the gallery a curated showcase. */
const TOP_N = 8;

/**
 * localStorage key holding the map of { [itemId]: true } the visitor has liked.
 * Bump the version suffix to wipe everyone's local state on next load. Note
 * that this no longer wipes the counts — those live on the server now.
 */
const LIKES_KEY = 'wc:fanart:liked:v2';

/** localStorage key for this browser's random id. Not an account, just dedupe. */
const VISITOR_KEY = 'wc:fanart:visitor';

/** Server counts, by item id. Empty until the first fetch lands. */
let counts = Object.create(null);

export function initFanArtGallery() {
  const grid = document.getElementById('fanartGrid');
  if (!grid) return;

  render(grid);
  hydrateLikes(grid);                 // instant, from localStorage
  grid.addEventListener('click', onLikeClick);
  hydrateCountsFromServer(grid);      // then reconcile with the shared counts
}

/**
 * Kept as a pure helper (filters by type) even though the gallery no longer
 * shows filter chips — it's covered by tests and handy if filtering returns.
 */
export function applyFanArtFilter(items, filter) {
  if (filter === 'all') return items;
  return items.filter((item) => item.type === filter);
}

function render(grid) {
  const visible = FAN_ART_ITEMS.slice(0, TOP_N);
  grid.innerHTML = visible.map(fanArtItemHTML).join('');
  observeNewElements(grid.querySelectorAll('.fanart-item'));
}

/* ---------- local state ---------- */

function readLiked() {
  try {
    return JSON.parse(localStorage.getItem(LIKES_KEY)) || {};
  } catch {
    return {};
  }
}

function writeLiked(map) {
  try {
    localStorage.setItem(LIKES_KEY, JSON.stringify(map));
  } catch {
    /* storage disabled (private mode) — likes just won't persist this session. */
  }
}

/**
 * This browser's id, minted once and kept. Exported for tests.
 * Falls back to a random string where crypto.randomUUID is unavailable, and to
 * a throwaway id when storage is blocked — in that case the visitor can
 * double-count across reloads, which is a fair trade for the page still working.
 */
export function getVisitorId() {
  try {
    const existing = localStorage.getItem(VISITOR_KEY);
    if (existing) return existing;
    const id = newId();
    localStorage.setItem(VISITOR_KEY, id);
    return id;
  } catch {
    return newId();
  }
}

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/* ---------- the counter ---------- */

/** fetch with a timeout, so a hanging counter never stalls the gallery. */
async function callApi(options = {}, { fetchImpl = fetch, timeout = LIKES_TIMEOUT_MS } = {}) {
  if (!LIKES_API_URL) return null;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeout) : null;
  try {
    const res = await fetchImpl(LIKES_API_URL, { ...options, signal: controller?.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null; // offline, blocked, aborted — caller falls back to local state
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Merge the server's counts into what is already on screen. Runs after the
 * local render so the hearts are never blank while this is in flight.
 */
async function hydrateCountsFromServer(grid, deps) {
  const data = await callApi({ method: 'GET' }, deps);
  if (!data || typeof data !== 'object') return;
  counts = data;
  const liked = readLiked();
  grid.querySelectorAll('.fanart-likes').forEach((btn) => {
    setLikeState(btn, !!liked[btn.dataset.id]);
  });
}

/** Paint the saved liked-state onto each tile after first render. */
function hydrateLikes(grid) {
  const liked = readLiked();
  grid.querySelectorAll('.fanart-likes').forEach((btn) => {
    setLikeState(btn, !!liked[btn.dataset.id]);
  });
}

async function onLikeClick(e, deps) {
  const btn = e.target.closest('.fanart-likes');
  if (!btn) return;

  const id = btn.dataset.id;
  const liked = readLiked();
  const isNowLiked = !liked[id];

  if (isNowLiked) liked[id] = true;
  else delete liked[id];
  writeLiked(liked);

  // Move the count optimistically so the heart responds on the same frame,
  // then let the server's number win once it answers.
  counts[id] = Math.max(0, (counts[id] ?? 0) + (isNowLiked ? 1 : -1));
  setLikeState(btn, isNowLiked);

  // Retrigger the pop animation.
  btn.classList.remove('pop');
  void btn.offsetWidth;
  if (isNowLiked) btn.classList.add('pop');

  const result = await callApi({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, liked: isNowLiked, visitor: getVisitorId() }),
  }, deps);

  // Server is authoritative when it answers. When it doesn't, the optimistic
  // count stands and the like is still remembered on this device.
  if (result && typeof result.count === 'number') {
    counts[id] = result.count;
    setLikeState(btn, isNowLiked);
  }
}

/**
 * Render one heart. The count is the shared total where we have one, and
 * otherwise the item's seed value from data/fanart.js — which keeps the old
 * behaviour intact when the counter is unreachable.
 */
function setLikeState(btn, isLiked) {
  const id = btn.dataset.id;
  const base = Number(btn.dataset.baseLikes) || 0;
  const count = counts[id] ?? (base + (isLiked ? 1 : 0));
  btn.classList.toggle('is-liked', isLiked);
  btn.setAttribute('aria-pressed', String(isLiked));
  const countEl = btn.querySelector('.fanart-like-count');
  if (countEl) countEl.textContent = Number(count).toLocaleString();
}

/* ---------- test seams ---------- */

export const __test = {
  setCounts: (next) => { counts = next; },
  getCounts: () => counts,
  hydrateCountsFromServer,
  onLikeClick,
  setLikeState,
};
