import { describe, test, expect } from 'vitest';
import { applyFanArtFilter } from '../js/modules/fanartGallery.js';

const items = [
  { id: '1', type: 'artwork' },
  { id: '2', type: 'pixel' },
  { id: '3', type: 'builds' },
  { id: '4', type: 'pixel' },
  { id: '5', type: 'screenshots' },
];

describe('applyFanArtFilter', () => {
  test('returns every item when filter is "all"', () => {
    const out = applyFanArtFilter(items, 'all');
    expect(out).toHaveLength(items.length);
  });

  test('returns only items matching the type filter', () => {
    const out = applyFanArtFilter(items, 'pixel');
    expect(out).toHaveLength(2);
    expect(out.every((i) => i.type === 'pixel')).toBe(true);
  });

  test('returns an empty array when nothing matches', () => {
    expect(applyFanArtFilter(items, 'unknown-type')).toEqual([]);
  });

  test('does not mutate the input array', () => {
    const before = items.map((i) => i.id);
    applyFanArtFilter(items, 'pixel');
    expect(items.map((i) => i.id)).toEqual(before);
  });
});

/* ---------- shared like counts ---------- */

import { getVisitorId, __test } from '../js/modules/fanartGallery.js';

/** Minimal like button, matching what fanartItem.js renders. */
function likeButton(id, baseLikes = 0) {
  const btn = document.createElement('button');
  btn.className = 'fanart-likes';
  btn.dataset.id = id;
  btn.dataset.baseLikes = String(baseLikes);
  const span = document.createElement('span');
  span.className = 'fanart-like-count';
  btn.appendChild(span);
  return btn;
}

describe('like counts', () => {
  test('renders the shared count when the server has one', () => {
    __test.setCounts({ 'fan-art-1': 42 });
    const btn = likeButton('fan-art-1');
    __test.setLikeState(btn, false);
    expect(btn.querySelector('.fanart-like-count').textContent).toBe('42');
  });

  test('a liked item shows the shared total, not the total plus one', () => {
    // The server count already includes this visitor's like.
    __test.setCounts({ 'fan-art-1': 42 });
    const btn = likeButton('fan-art-1');
    __test.setLikeState(btn, true);
    expect(btn.querySelector('.fanart-like-count').textContent).toBe('42');
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  test('falls back to the seed count when the counter is unreachable', () => {
    __test.setCounts({});
    const btn = likeButton('fan-art-9', 7);
    __test.setLikeState(btn, false);
    expect(btn.querySelector('.fanart-like-count').textContent).toBe('7');
    __test.setLikeState(btn, true);
    expect(btn.querySelector('.fanart-like-count').textContent).toBe('8');
  });

  test('hydrating merges server counts onto rendered tiles', async () => {
    __test.setCounts({});
    const grid = document.createElement('div');
    grid.appendChild(likeButton('fan-art-1'));
    grid.appendChild(likeButton('fan-art-2'));
    const fetchImpl = async () => ({ ok: true, json: async () => ({ 'fan-art-1': 5, 'fan-art-2': 9 }) });
    await __test.hydrateCountsFromServer(grid, { fetchImpl, timeout: 50 });
    const [a, b] = grid.querySelectorAll('.fanart-like-count');
    expect(a.textContent).toBe('5');
    expect(b.textContent).toBe('9');
  });

  test('a failing counter leaves the gallery rendering local state', async () => {
    __test.setCounts({});
    const grid = document.createElement('div');
    grid.appendChild(likeButton('fan-art-1', 3));
    const fetchImpl = async () => { throw new Error('offline'); };
    await __test.hydrateCountsFromServer(grid, { fetchImpl, timeout: 50 });
    expect(__test.getCounts()).toEqual({});
  });

  test('clicking updates optimistically, then takes the server total', async () => {
    __test.setCounts({ 'fan-art-1': 10 });
    const grid = document.createElement('div');
    const btn = likeButton('fan-art-1');
    grid.appendChild(btn);
    let sent = null;
    const fetchImpl = async (_url, opts) => {
      sent = JSON.parse(opts.body);
      return { ok: true, json: async () => ({ id: 'fan-art-1', liked: true, count: 99 }) };
    };
    await __test.onLikeClick({ target: btn }, { fetchImpl, timeout: 50 });
    expect(sent.id).toBe('fan-art-1');
    expect(sent.liked).toBe(true);
    expect(typeof sent.visitor).toBe('string');
    expect(btn.querySelector('.fanart-like-count').textContent).toBe('99');
  });

  test('the optimistic count stands when the server never answers', async () => {
    __test.setCounts({ 'fan-art-3': 4 });
    localStorage.clear();
    const btn = likeButton('fan-art-3');
    const fetchImpl = async () => { throw new Error('offline'); };
    await __test.onLikeClick({ target: btn }, { fetchImpl, timeout: 50 });
    expect(btn.querySelector('.fanart-like-count').textContent).toBe('5');
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  test('the visitor id is minted once and then reused', () => {
    localStorage.clear();
    const first = getVisitorId();
    expect(first).toMatch(/^[a-f0-9-]{8,64}$/i);
    expect(getVisitorId()).toBe(first);
  });
});
