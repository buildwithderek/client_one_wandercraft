import { describe, test, expect } from 'vitest';
import { formatRelativeDate } from '../js/modules/youtubeFeed.js';

const now = Date.UTC(2026, 8, 11, 12, 0, 0); // 2026-09-11T12:00:00Z
const ago = (seconds) => new Date(now - seconds * 1000).toISOString();

describe('formatRelativeDate', () => {
  test('singular units read as singular', () => {
    expect(formatRelativeDate(ago(3600), now)).toBe('1 hour ago');
    expect(formatRelativeDate(ago(86_400), now)).toBe('1 day ago');
    expect(formatRelativeDate(ago(604_800), now)).toBe('1 week ago');
    expect(formatRelativeDate(ago(2_629_800), now)).toBe('1 month ago');
    expect(formatRelativeDate(ago(31_557_600), now)).toBe('1 year ago');
  });

  test('plural units read as plural', () => {
    expect(formatRelativeDate(ago(3 * 3600), now)).toBe('3 hours ago');
    expect(formatRelativeDate(ago(8 * 86_400), now)).toBe('1 week ago');
    expect(formatRelativeDate(ago(3 * 604_800), now)).toBe('3 weeks ago');
    expect(formatRelativeDate(ago(50 * 2_629_800), now)).toBe('4 years ago');
  });

  test('minutes keep the abbreviated form', () => {
    expect(formatRelativeDate(ago(60), now)).toBe('1 min ago');
    expect(formatRelativeDate(ago(5 * 60), now)).toBe('5 min ago');
    expect(formatRelativeDate(ago(10), now)).toBe('just now');
  });

  test('missing or unparseable dates render as empty, never as a lie', () => {
    expect(formatRelativeDate(null, now)).toBe('');
    expect(formatRelativeDate('', now)).toBe('');
    expect(formatRelativeDate('not a date', now)).toBe('');
  });
});
