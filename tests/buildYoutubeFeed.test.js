/**
 * The feed builder is the only code that writes production data, and the
 * dashboard sorts on the dates it emits. These cover the pure parts: how a
 * date is chosen, how "N months ago" is approximated, and how undated items
 * sort. Network scraping is deliberately not exercised here.
 */

import { describe, test, expect } from 'vitest';
import {
  resolvePublishedAt,
  relativeToISO,
  sortNewestFirst,
  parseViews,
} from '../scripts/build-youtube-feed.mjs';

describe('resolvePublishedAt', () => {
  test('an exact RSS date wins over everything', () => {
    expect(resolvePublishedAt({
      exact: '2026-06-24T03:42:00.000Z',
      known: '2026-09-11T01:59:27.000Z',
      approx: '2026-09-10T00:00:00.000Z',
    })).toBe('2026-06-24T03:42:00.000Z');
  });

  test('a date already on file beats a fresh approximation', () => {
    // This is the anti-drift rule: the approximation is recomputed against
    // the clock every run, the known value is not.
    expect(resolvePublishedAt({
      known: '2026-04-07T21:18:00.000Z',
      approx: '2026-04-11T21:29:00.000Z',
    })).toBe('2026-04-07T21:18:00.000Z');
  });

  test('falls back to the approximation on first sighting', () => {
    expect(resolvePublishedAt({ approx: '2026-01-01T00:00:00.000Z' }))
      .toBe('2026-01-01T00:00:00.000Z');
  });

  test('never invents a date — unknown stays null', () => {
    expect(resolvePublishedAt({})).toBe(null);
    expect(resolvePublishedAt({ exact: undefined, known: undefined, approx: null })).toBe(null);
    expect(resolvePublishedAt()).toBe(null);
  });
});

describe('relativeToISO', () => {
  const now = Date.UTC(2026, 8, 11, 12, 0, 0); // 2026-09-11T12:00:00Z

  test('subtracts the stated interval from the supplied clock', () => {
    expect(relativeToISO('3 days ago', now)).toBe('2026-09-08T12:00:00.000Z');
    expect(relativeToISO('2 hours ago', now)).toBe('2026-09-11T10:00:00.000Z');
    expect(relativeToISO('1 week ago', now)).toBe('2026-09-04T12:00:00.000Z');
  });

  test('strips the "Streamed" prefix the streams tab adds', () => {
    expect(relativeToISO('Streamed 10 hours ago', now)).toBe('2026-09-11T02:00:00.000Z');
  });

  test('handles singular and plural units', () => {
    expect(relativeToISO('1 year ago', now)).toBe(relativeToISO('1 years ago', now));
  });

  test('returns null for anything that is not a relative time', () => {
    expect(relativeToISO(null)).toBe(null);
    expect(relativeToISO('')).toBe(null);
    expect(relativeToISO('31 views')).toBe(null);
    expect(relativeToISO('Premieres in 2 days')).toBe(null);
  });
});

describe('sortNewestFirst', () => {
  const items = [
    { id: 'undated-a', publishedAt: null },
    { id: 'old',       publishedAt: '2025-12-30T20:30:15.000Z' },
    { id: 'undated-b', publishedAt: null },
    { id: 'new',       publishedAt: '2026-09-02T19:54:00.000Z' },
    { id: 'mid',       publishedAt: '2026-06-24T03:42:00.000Z' },
  ];

  test('dated items come first, newest to oldest', () => {
    expect(sortNewestFirst(items).map((i) => i.id).slice(0, 3)).toEqual(['new', 'mid', 'old']);
  });

  test('undated items sort last and keep their relative order', () => {
    expect(sortNewestFirst(items).map((i) => i.id).slice(3)).toEqual(['undated-a', 'undated-b']);
  });

  test('does not mutate the input', () => {
    const before = items.map((i) => i.id);
    sortNewestFirst(items);
    expect(items.map((i) => i.id)).toEqual(before);
  });
});

describe('parseViews', () => {
  test('parses YouTube view strings', () => {
    expect(parseViews('881 views')).toBe(881);
    expect(parseViews('7.5K views')).toBe(7500);
    expect(parseViews('1.2M views')).toBe(1_200_000);
  });

  test('returns null when there is nothing to parse', () => {
    expect(parseViews(null)).toBe(null);
    expect(parseViews('')).toBe(null);
  });
});
