/**
 * The "Latest Adventures" content dashboard.
 *
 * Single source of truth: an in-memory `state` object. Filter and sort changes
 * mutate state, then we re-render. That fixes the original bug where toggling
 * a filter after sorting lost the sort (because the old code worked by
 * toggling display:none on already-rendered cards).
 *
 * Load More appends from a queue rather than fetching — the data is bundled,
 * the queue is just "items not yet rendered."
 */

import {
  CONTENT_ITEMS,
  CONTENT_FILTERS,
  CONTENT_SORTS,
  INITIAL_VISIBLE_COUNT,
} from '../data/content.js';
import { contentCardHTML } from '../components/contentCard.js';
import { parseViews } from '../utils/parseViews.js';
import { fetchLatestVideos } from './youtubeFeed.js';

/** How many additional items to reveal per Load More click. */
const LOAD_MORE_BATCH = 6;

/**
 * The dashboard's data source. Starts pointing at the static demo array.
 * If the Worker is configured and the fetch succeeds, this gets swapped
 * to the live videos and the grid re-renders. Static fallback means the
 * dashboard is never blank — even before the Worker is deployed.
 */
let items = CONTENT_ITEMS;

const state = {
  filter: 'all',
  sort: 'recent',
  visibleCount: INITIAL_VISIBLE_COUNT,
};

export function initContentDashboard() {
  const grid = document.getElementById('contentGrid');
  if (!grid) return;

  renderFilterBar();
  renderSortDropdown();
  render(grid);            // immediate static render
  bindLoadMore(grid);

  // Try the live source. If anything is missing (Worker not configured,
  // network down, no channel IDs filled in), fetchLatestVideos returns
  // null and we keep the static render.
  hydrateFromWorker(grid);
}

async function hydrateFromWorker(grid) {
  const live = await fetchLatestVideos();
  if (!live || live.length === 0) return;
  items = live;
  state.visibleCount = INITIAL_VISIBLE_COUNT;
  render(grid);
}

/* ---------- internal helpers ---------- */

/**
 * Apply the current filter, then sort. Pure: takes the full source list,
 * returns the displayed slice. Easy to unit-test.
 */
export function applyFilterAndSort(items, { filter, sort }) {
  const filtered = filter === 'all'
    ? items
    : items.filter((item) => item.type === filter);

  if (sort === 'popular') {
    return [...filtered].sort((a, b) => parseViews(b.views) - parseViews(a.views));
  }
  if (sort === 'creator') {
    return [...filtered].sort((a, b) => a.creator.localeCompare(b.creator));
  }
  // 'recent' = source order, which is already chronological-newest-first.
  return filtered;
}

function render(grid) {
  const matching = applyFilterAndSort(items, state);
  const visible = matching.slice(0, state.visibleCount);
  grid.innerHTML = visible.map((item, i) => contentCardHTML(item, i)).join('');

  updateLoadMoreState();
  announce(grid, visible.length, matching.length);
}

/**
 * Say out loud what just changed.
 *
 * Filtering, sorting and Load More all rebuild the grid silently — sighted
 * users see the cards change, screen-reader users got nothing at all. This
 * polite live region reports the result count after every render.
 */
function announce(grid, shown, total) {
  let region = document.getElementById('contentStatus');
  if (!region) {
    region = document.createElement('p');
    region.id = 'contentStatus';
    region.className = 'sr-only';
    region.setAttribute('role', 'status');      // implies aria-live="polite"
    grid.parentNode.insertBefore(region, grid);
  }
  const label = (CONTENT_FILTERS.find((f) => f.value === state.filter) || {}).label || 'items';
  region.textContent = total === 0
    ? `No ${label.toLowerCase()} to show.`
    : `Showing ${shown} of ${total} ${label.toLowerCase()}.`;
}

function renderFilterBar() {
  const bar = document.querySelector('.content-filters');
  if (!bar) return;
  // Not tabs: there are no tabpanels, no aria-controls and no arrow-key
  // navigation, so claiming role="tablist" promised a keyboard contract the
  // component never honoured. These are toggle buttons over one shared grid,
  // which is what aria-pressed describes. The group role also gives the
  // existing aria-label something to attach to.
  bar.setAttribute('role', 'group');
  bar.innerHTML = CONTENT_FILTERS.map(
    (f) => `
      <button
        type="button"
        class="filter-btn ${f.value === state.filter ? 'active' : ''}"
        data-filter="${f.value}"
        aria-pressed="${f.value === state.filter}">${f.label}</button>
    `,
  ).join('');

  bar.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    state.filter = btn.dataset.filter;
    state.visibleCount = INITIAL_VISIBLE_COUNT;  // reset pagination on filter change
    bar.querySelectorAll('.filter-btn').forEach((b) => {
      const active = b === btn;
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', String(active));
    });
    const grid = document.getElementById('contentGrid');
    if (grid) render(grid);
  });
}

function renderSortDropdown() {
  const select = document.getElementById('contentSort');
  if (!select) return;
  select.innerHTML = CONTENT_SORTS.map(
    (s) => `<option value="${s.value}">${s.label}</option>`,
  ).join('');
  select.value = state.sort;

  select.addEventListener('change', () => {
    state.sort = select.value;
    const grid = document.getElementById('contentGrid');
    if (grid) render(grid);
  });
}

function bindLoadMore(grid) {
  const btn = document.getElementById('loadMore');
  if (!btn) return;

  btn.addEventListener('click', () => {
    // aria-disabled, not disabled — see updateLoadMoreState.
    if (btn.getAttribute('aria-disabled') === 'true') return;

    state.visibleCount += LOAD_MORE_BATCH;
    btn.textContent = 'Loading...';
    btn.setAttribute('aria-busy', 'true');
    btn.setAttribute('aria-disabled', 'true');

    // Tiny delay so the loading state is visible — purely UX polish.
    setTimeout(() => {
      render(grid);
      btn.removeAttribute('aria-busy');
      updateLoadMoreState();
    }, 250);
  });
}

function updateLoadMoreState() {
  const btn = document.getElementById('loadMore');
  if (!btn) return;
  const total = applyFilterAndSort(items, state).length;
  const exhausted = state.visibleCount >= total;

  // aria-disabled rather than the disabled property. A disabled button drops
  // out of the tab order, so pressing Load More until the list ran out threw
  // the user's focus back to <body> and lost their place on the page. This
  // keeps it focusable and inert; the click handler returns early.
  btn.setAttribute('aria-disabled', String(exhausted));
  btn.textContent = exhausted ? 'All caught up!' : 'Load More';
  btn.style.opacity = exhausted ? '0.5' : '';
}
