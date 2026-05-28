import { describe, it, expect } from 'vitest';
import { formatRelativeTime } from './format-relative-time';

// Frozen anchor for deterministic deltas across runs / timezones.
// 2026-05-29T12:00:00Z (month is 0-indexed in Date.UTC).
const FROZEN_NOW_MS = Date.UTC(2026, 4, 29, 12, 0, 0);

const ONE_MINUTE_MS = 60_000;
const ONE_HOUR_MS = 60 * ONE_MINUTE_MS;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;
const ONE_WEEK_MS = 7 * ONE_DAY_MS;

/** Build an ISO string `deltaMs` in the past relative to the frozen anchor. */
function isoAgo(deltaMs: number): string {
  return new Date(FROZEN_NOW_MS - deltaMs).toISOString();
}

/** Build an ISO string `deltaMs` in the future relative to the frozen anchor. */
function isoAhead(deltaMs: number): string {
  return new Date(FROZEN_NOW_MS + deltaMs).toISOString();
}

describe('formatRelativeTime', () => {
  describe('fresh band — under 60s', () => {
    const cases: Array<[string, number, string]> = [
      ['just emitted (0ms ago)', 0, 'Just now'],
      ['1 second ago', 1_000, 'Just now'],
      ['30 seconds ago', 30_000, 'Just now'],
      ['59 seconds ago', 59_000, 'Just now'],
      ['exactly 59999ms ago (just under 60s boundary)', 59_999, 'Just now'],
    ];
    it.each(cases)('%s → "%s"', (_desc, deltaMs, expected) => {
      const result = formatRelativeTime(isoAgo(deltaMs), FROZEN_NOW_MS);
      expect(result.label).toBe(expected);
      expect(result.freshness).toBe('fresh');
    });
  });

  describe('fresh band — minutes [60s, 1h)', () => {
    const cases: Array<[string, number, string]> = [
      ['exactly 60s (boundary into minutes band)', ONE_MINUTE_MS, '1 min ago'],
      ['1 minute', ONE_MINUTE_MS, '1 min ago'],
      ['2 minutes', 2 * ONE_MINUTE_MS, '2 min ago'],
      ['30 minutes', 30 * ONE_MINUTE_MS, '30 min ago'],
      ['59 minutes', 59 * ONE_MINUTE_MS, '59 min ago'],
    ];
    it.each(cases)('%s → "%s"', (_desc, deltaMs, expected) => {
      const result = formatRelativeTime(isoAgo(deltaMs), FROZEN_NOW_MS);
      expect(result.label).toBe(expected);
      expect(result.freshness).toBe('fresh');
    });
  });

  describe('fresh band — hours [1h, 24h)', () => {
    const cases: Array<[string, number, string]> = [
      ['exactly 1h (boundary into hours band)', ONE_HOUR_MS, '1 hour ago'],
      ['2 hours (plural)', 2 * ONE_HOUR_MS, '2 hours ago'],
      ['5 hours', 5 * ONE_HOUR_MS, '5 hours ago'],
      ['23 hours', 23 * ONE_HOUR_MS, '23 hours ago'],
    ];
    it.each(cases)('%s → "%s"', (_desc, deltaMs, expected) => {
      const result = formatRelativeTime(isoAgo(deltaMs), FROZEN_NOW_MS);
      expect(result.label).toBe(expected);
      expect(result.freshness).toBe('fresh');
    });
  });

  describe('stale band — days [24h, 7d)', () => {
    const cases: Array<[string, number, string]> = [
      ['exactly 24h (boundary into days band)', ONE_DAY_MS, '1 day ago'],
      ['2 days (plural)', 2 * ONE_DAY_MS, '2 days ago'],
      ['3 days', 3 * ONE_DAY_MS, '3 days ago'],
      ['6 days', 6 * ONE_DAY_MS, '6 days ago'],
      [
        'just under 7d (boundary, exclusive)',
        ONE_WEEK_MS - ONE_MINUTE_MS,
        '6 days ago',
      ],
    ];
    it.each(cases)('%s → "%s"', (_desc, deltaMs, expected) => {
      const result = formatRelativeTime(isoAgo(deltaMs), FROZEN_NOW_MS);
      expect(result.label).toBe(expected);
      expect(result.freshness).toBe('stale');
    });
  });

  describe('very-stale band — locale short date [>= 7d]', () => {
    it('exactly 7d ago renders very-stale with locale date prefixed by "on "', () => {
      const result = formatRelativeTime(isoAgo(ONE_WEEK_MS), FROZEN_NOW_MS);
      // Locale-fragile: only assert prefix + freshness band, not the literal date.
      expect(result.label.startsWith('on ')).toBe(true);
      expect(result.freshness).toBe('very-stale');
    });

    it('30 days ago renders very-stale with locale date prefixed by "on "', () => {
      const result = formatRelativeTime(isoAgo(30 * ONE_DAY_MS), FROZEN_NOW_MS);
      expect(result.label.startsWith('on ')).toBe(true);
      expect(result.freshness).toBe('very-stale');
    });

    it('1 year ago renders very-stale with locale date prefixed by "on "', () => {
      const result = formatRelativeTime(isoAgo(365 * ONE_DAY_MS), FROZEN_NOW_MS);
      expect(result.label.startsWith('on ')).toBe(true);
      expect(result.freshness).toBe('very-stale');
    });
  });

  describe('never band — missing or unparseable input', () => {
    const cases: Array<[string, string | null | undefined]> = [
      ['null', null],
      ['undefined', undefined],
      ['empty string', ''],
      ['unparseable string ("not-a-date")', 'not-a-date'],
    ];
    it.each(cases)('%s → "No backups yet" / never', (_desc, input) => {
      const result = formatRelativeTime(input, FROZEN_NOW_MS);
      expect(result.label).toBe('No backups yet');
      expect(result.freshness).toBe('never');
    });
  });

  describe('clock-skew / future timestamps', () => {
    it('5 minutes in the future clamps to "Just now" / fresh', () => {
      const result = formatRelativeTime(
        isoAhead(5 * ONE_MINUTE_MS),
        FROZEN_NOW_MS,
      );
      expect(result.label).toBe('Just now');
      expect(result.freshness).toBe('fresh');
    });

    it('1 day in the future clamps to "Just now" / fresh', () => {
      const result = formatRelativeTime(isoAhead(ONE_DAY_MS), FROZEN_NOW_MS);
      expect(result.label).toBe('Just now');
      expect(result.freshness).toBe('fresh');
    });

    it('30 seconds in the future (sub-minute skew) clamps to "Just now" / fresh', () => {
      const result = formatRelativeTime(isoAhead(30_000), FROZEN_NOW_MS);
      expect(result.label).toBe('Just now');
      expect(result.freshness).toBe('fresh');
    });
  });

  describe('nowMs default', () => {
    it('uses Date.now() when nowMs is omitted', () => {
      // An ISO string set to "now" should resolve to "Just now" without an explicit anchor.
      const result = formatRelativeTime(new Date().toISOString());
      expect(result.label).toBe('Just now');
      expect(result.freshness).toBe('fresh');
    });
  });
});
