/**
 * Pins the feedConfig / liveConfig split.
 *
 * These two started as one file and drifted into holding unrelated
 * concerns — the static video feed (no infrastructure) and runtime live
 * status (a Cloudflare Worker). Splitting them only stays useful if
 * constants don't wander back, so the module surfaces are asserted here.
 */

import { describe, test, expect } from 'vitest';
import * as feedConfig from '../js/data/feedConfig.js';
import * as liveConfig from '../js/data/liveConfig.js';

describe('config module split', () => {
  test('feedConfig exports exactly the feed constants', () => {
    expect(Object.keys(feedConfig).sort()).toEqual(['INITIAL_VIDEO_COUNT', 'STATIC_FEED_PATH']);
  });

  test('liveConfig exports exactly the live constants', () => {
    expect(Object.keys(liveConfig).sort()).toEqual(['LIVE_WORKER_BASE_URL', 'TIKTOK_LIVE_ENABLED']);
  });

  test('the two share no exports', () => {
    const overlap = Object.keys(feedConfig).filter((k) => k in liveConfig);
    expect(overlap).toEqual([]);
  });

  test('values carry the types their consumers expect', () => {
    expect(typeof feedConfig.STATIC_FEED_PATH).toBe('string');
    expect(typeof feedConfig.INITIAL_VIDEO_COUNT).toBe('number');
    expect(typeof liveConfig.LIVE_WORKER_BASE_URL).toBe('string');
    expect(typeof liveConfig.TIKTOK_LIVE_ENABLED).toBe('boolean');
  });
});
