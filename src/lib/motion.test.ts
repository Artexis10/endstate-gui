import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  prefersReducedMotion,
  getTransition,
  getLayoutTransition,
  getExpandCollapseVariants,
  getFadeSlideVariants,
  getFadeVariants,
  DURATIONS,
  EASING,
} from './motion';

// Helper to mock matchMedia
function mockMatchMedia(prefersReduced: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)' && prefersReduced,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe('prefersReducedMotion', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns false when matchMedia is not available', () => {
    const original = window.matchMedia;
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: undefined,
    });
    expect(prefersReducedMotion()).toBe(false);
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: original,
    });
  });

  it('returns false when user does not prefer reduced motion', () => {
    mockMatchMedia(false);
    expect(prefersReducedMotion()).toBe(false);
  });

  it('returns true when user prefers reduced motion', () => {
    mockMatchMedia(true);
    expect(prefersReducedMotion()).toBe(true);
  });
});

describe('getTransition', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns normal transition when reduced motion is off', () => {
    mockMatchMedia(false);
    const t = getTransition();
    expect(t).toEqual({
      duration: DURATIONS.normal,
      ease: EASING.easeInOut,
    });
  });

  it('returns near-instant transition when reduced motion is on', () => {
    mockMatchMedia(true);
    const t = getTransition();
    expect(t).toEqual({ duration: 0.01 });
  });

  it('accepts custom duration and easing', () => {
    mockMatchMedia(false);
    const t = getTransition('fast', 'easeOut');
    expect(t).toEqual({
      duration: DURATIONS.fast,
      ease: EASING.easeOut,
    });
  });

  it('accepts slow duration', () => {
    mockMatchMedia(false);
    const t = getTransition('slow', 'easeIn');
    expect(t).toEqual({
      duration: DURATIONS.slow,
      ease: EASING.easeIn,
    });
  });

  it('ignores custom params when reduced motion is on', () => {
    mockMatchMedia(true);
    const t = getTransition('slow', 'easeOut');
    expect(t).toEqual({ duration: 0.01 });
  });
});

describe('getLayoutTransition', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns spring transition when reduced motion is off', () => {
    mockMatchMedia(false);
    const t = getLayoutTransition();
    expect(t).toEqual({
      type: 'spring',
      stiffness: 500,
      damping: 40,
      mass: 1,
    });
  });

  it('returns near-instant transition when reduced motion is on', () => {
    mockMatchMedia(true);
    const t = getLayoutTransition();
    expect(t).toEqual({ duration: 0.01 });
  });
});

describe('getExpandCollapseVariants', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns variants with normal durations when reduced motion is off', () => {
    mockMatchMedia(false);
    const variants = getExpandCollapseVariants();
    expect(variants).toHaveProperty('collapsed');
    expect(variants).toHaveProperty('expanded');
    expect((variants.collapsed as any).transition.duration).toBe(DURATIONS.fast);
    expect((variants.expanded as any).transition.duration).toBe(DURATIONS.normal);
  });

  it('returns variants with near-instant durations when reduced motion is on', () => {
    mockMatchMedia(true);
    const variants = getExpandCollapseVariants();
    expect((variants.collapsed as any).transition.duration).toBe(0.01);
    expect((variants.expanded as any).transition.duration).toBe(0.01);
  });

  it('collapsed variant has opacity 0 and height 0', () => {
    mockMatchMedia(false);
    const variants = getExpandCollapseVariants();
    expect((variants.collapsed as any).opacity).toBe(0);
    expect((variants.collapsed as any).height).toBe(0);
    expect((variants.collapsed as any).overflow).toBe('hidden');
  });

  it('expanded variant has opacity 1 and height auto', () => {
    mockMatchMedia(false);
    const variants = getExpandCollapseVariants();
    expect((variants.expanded as any).opacity).toBe(1);
    expect((variants.expanded as any).height).toBe('auto');
  });
});

describe('getFadeSlideVariants', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns initial/animate/exit variants for "up" direction', () => {
    mockMatchMedia(false);
    const variants = getFadeSlideVariants('up');
    expect(variants).toHaveProperty('initial');
    expect(variants).toHaveProperty('animate');
    expect(variants).toHaveProperty('exit');
    // "up" means initial y is positive (below), exit y is negative (above)
    expect((variants.initial as any).y).toBeGreaterThan(0);
    expect((variants.animate as any).y).toBe(0);
    expect((variants.exit as any).y).toBeLessThan(0);
  });

  it('returns initial/animate/exit variants for "down" direction', () => {
    mockMatchMedia(false);
    const variants = getFadeSlideVariants('down');
    // "down" means initial y is negative, exit y is positive
    expect((variants.initial as any).y).toBeLessThan(0);
    expect((variants.exit as any).y).toBeGreaterThan(0);
  });

  it('uses zero distance when reduced motion is on', () => {
    mockMatchMedia(true);
    const variants = getFadeSlideVariants('up');
    expect((variants.initial as any).y).toBe(0);
    expect(Math.abs((variants.exit as any).y)).toBe(0);
    expect((variants.initial as any).opacity).toBe(0);
  });

  it('defaults to "up" direction', () => {
    mockMatchMedia(false);
    const upVariants = getFadeSlideVariants('up');
    const defaultVariants = getFadeSlideVariants();
    expect((defaultVariants.initial as any).y).toBe((upVariants.initial as any).y);
  });
});

describe('getFadeVariants', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns initial/animate/exit variants', () => {
    mockMatchMedia(false);
    const variants = getFadeVariants();
    expect(variants).toHaveProperty('initial');
    expect(variants).toHaveProperty('animate');
    expect(variants).toHaveProperty('exit');
  });

  it('initial has opacity 0', () => {
    mockMatchMedia(false);
    const variants = getFadeVariants();
    expect((variants.initial as any).opacity).toBe(0);
  });

  it('animate has opacity 1', () => {
    mockMatchMedia(false);
    const variants = getFadeVariants();
    expect((variants.animate as any).opacity).toBe(1);
  });

  it('exit has opacity 0', () => {
    mockMatchMedia(false);
    const variants = getFadeVariants();
    expect((variants.exit as any).opacity).toBe(0);
  });

  it('uses near-instant duration when reduced motion is on', () => {
    mockMatchMedia(true);
    const variants = getFadeVariants();
    expect((variants.animate as any).transition.duration).toBe(0.01);
    expect((variants.exit as any).transition.duration).toBe(0.01);
  });

  it('uses normal easing when reduced motion is off', () => {
    mockMatchMedia(false);
    const variants = getFadeVariants();
    expect((variants.animate as any).transition.ease).toEqual(EASING.easeOut);
    expect((variants.exit as any).transition.ease).toEqual(EASING.easeIn);
  });
});

describe('constants', () => {
  it('DURATIONS has expected keys', () => {
    expect(DURATIONS).toEqual({
      fast: 0.15,
      normal: 0.2,
      slow: 0.3,
    });
  });

  it('EASING has expected keys', () => {
    expect(EASING).toHaveProperty('easeOut');
    expect(EASING).toHaveProperty('easeIn');
    expect(EASING).toHaveProperty('easeInOut');
  });
});
