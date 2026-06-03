import { describe, it, expect } from 'vitest';
import { assessPrePushQuota } from './pre-push-quota';

const GiB = 1024 * 1024 * 1024;

describe('assessPrePushQuota', () => {
  it('never warns when quota is unknown (older substrate / signed out)', () => {
    expect(assessPrePushQuota(900 * 1024 * 1024, undefined, undefined)).toEqual({
      level: 'ok',
      exceeds: false,
    });
    expect(assessPrePushQuota(900 * 1024 * 1024, 0, 0).level).toBe('ok');
  });

  it('is ok for a comfortable push (well under 90% of quota)', () => {
    const a = assessPrePushQuota(10 * 1024 * 1024, 100 * 1024 * 1024, GiB); // ~10 MiB into ~10% used
    expect(a.level).toBe('ok');
    expect(a.exceeds).toBe(false);
    expect(a.remainingBytes).toBe(GiB - 100 * 1024 * 1024);
  });

  it('warns (not exceeds) when the push lands usage in the top 10% of quota', () => {
    // 850 MiB used + 100 MiB push = 950 MiB of 1024 MiB → > 90%, still fits.
    const a = assessPrePushQuota(100 * 1024 * 1024, 850 * 1024 * 1024, GiB);
    expect(a.level).toBe('warn');
    expect(a.exceeds).toBe(false);
  });

  it('warns and flags exceeds when the push overflows the quota', () => {
    // 900 MiB used + 200 MiB push = 1100 MiB > 1024 MiB.
    const a = assessPrePushQuota(200 * 1024 * 1024, 900 * 1024 * 1024, GiB);
    expect(a.level).toBe('warn');
    expect(a.exceeds).toBe(true);
  });

  it('computes whole pushes left from the remaining quota', () => {
    // 24 MiB remaining, 10 MiB push → 2 more pushes fit.
    const a = assessPrePushQuota(10 * 1024 * 1024, (GiB / (1024 * 1024) - 24) * 1024 * 1024, GiB);
    expect(a.pushesLeft).toBe(2);
  });

  it('treats a zero-byte estimate as ok with undefined pushesLeft', () => {
    const a = assessPrePushQuota(0, 0, GiB);
    expect(a.level).toBe('ok');
    expect(a.pushesLeft).toBeUndefined();
  });
});
