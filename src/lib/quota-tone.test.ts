import { describe, it, expect } from 'vitest';
import { quotaTone } from './quota-tone';

const TOTAL = 100 * 1024 * 1024 * 1024; // 100 GiB — arbitrary, exercises rounding

describe('quotaTone', () => {
  describe('normal band (< 50%)', () => {
    it('returns normal at 0%', () => {
      expect(quotaTone(0, TOTAL)).toEqual({ pct: 0, tone: 'normal' });
    });

    it('returns normal mid-band', () => {
      expect(quotaTone(TOTAL * 0.25, TOTAL)).toEqual({ pct: 25, tone: 'normal' });
    });

    it('returns normal just below the warn boundary', () => {
      // 49.4% rounds to 49 → normal
      expect(quotaTone(TOTAL * 0.494, TOTAL)).toEqual({ pct: 49, tone: 'normal' });
    });
  });

  describe('warn band ([50%, 90%))', () => {
    it('flips to warn at exactly 50%', () => {
      expect(quotaTone(TOTAL * 0.5, TOTAL)).toEqual({ pct: 50, tone: 'warn' });
    });

    it('stays warn mid-band', () => {
      expect(quotaTone(TOTAL * 0.75, TOTAL)).toEqual({ pct: 75, tone: 'warn' });
    });

    it('stays warn just below the danger boundary', () => {
      // 89.4% rounds to 89 → warn
      expect(quotaTone(TOTAL * 0.894, TOTAL)).toEqual({ pct: 89, tone: 'warn' });
    });
  });

  describe('danger band (>= 90%)', () => {
    it('flips to danger at exactly 90%', () => {
      expect(quotaTone(TOTAL * 0.9, TOTAL)).toEqual({ pct: 90, tone: 'danger' });
    });

    it('stays danger between 90% and 100%', () => {
      expect(quotaTone(TOTAL * 0.95, TOTAL)).toEqual({ pct: 95, tone: 'danger' });
    });

    it('returns danger at exactly 100%', () => {
      expect(quotaTone(TOTAL, TOTAL)).toEqual({ pct: 100, tone: 'danger' });
    });
  });

  describe('clamping & edges', () => {
    it('clamps pct to 100 when over quota', () => {
      expect(quotaTone(TOTAL * 2, TOTAL)).toEqual({ pct: 100, tone: 'danger' });
    });

    it('clamps negative used to 0', () => {
      expect(quotaTone(-500, TOTAL)).toEqual({ pct: 0, tone: 'normal' });
    });

    it('treats zero used as 0%', () => {
      expect(quotaTone(0, TOTAL)).toEqual({ pct: 0, tone: 'normal' });
    });

    it('rounds half-up at the 50% boundary', () => {
      // 49.5% rounds to 50 → warn (Math.round half-to-even/up; 49.5→50 in JS)
      expect(quotaTone(TOTAL * 0.495, TOTAL)).toEqual({ pct: 50, tone: 'warn' });
    });

    it('rounds half-up at the 90% boundary', () => {
      // 89.5% rounds to 90 → danger
      expect(quotaTone(TOTAL * 0.895, TOTAL)).toEqual({ pct: 90, tone: 'danger' });
    });
  });

  describe('invalid total guard', () => {
    it('throws when totalBytes is zero', () => {
      expect(() => quotaTone(0, 0)).toThrow(RangeError);
    });

    it('throws when totalBytes is negative', () => {
      expect(() => quotaTone(100, -1)).toThrow(RangeError);
    });

    it('throws when totalBytes is NaN', () => {
      expect(() => quotaTone(100, Number.NaN)).toThrow(RangeError);
    });
  });
});
