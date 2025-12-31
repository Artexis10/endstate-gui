/**
 * Shared motion system for Endstate GUI
 * 
 * Provides consistent animation variants, durations, and easing curves
 * for high-signal state transitions. Respects prefers-reduced-motion.
 */

import type { Variants, Transition } from 'framer-motion';

// ─────────────────────────────────────────────────────────────────────────────
// Timing constants
// ─────────────────────────────────────────────────────────────────────────────

export const DURATIONS = {
  fast: 0.15,
  normal: 0.2,
  slow: 0.3,
} as const;

export const DISTANCES = {
  subtle: 4,
  normal: 8,
  large: 16,
} as const;

// Standard easing curves (cubic-bezier)
export const EASING = {
  // Smooth deceleration - good for enter animations
  easeOut: [0.0, 0.0, 0.2, 1] as const,
  // Smooth acceleration - good for exit animations
  easeIn: [0.4, 0.0, 1, 1] as const,
  // Smooth both ways - good for layout shifts
  easeInOut: [0.4, 0.0, 0.2, 1] as const,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Reduced motion detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if user prefers reduced motion.
 * Safe for SSR and test environments (returns false if window or matchMedia is undefined).
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ─────────────────────────────────────────────────────────────────────────────
// Transition helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get a transition config that respects reduced motion preferences.
 * With reduced motion: instant or very short opacity-only transitions.
 */
export function getTransition(
  duration: keyof typeof DURATIONS = 'normal',
  easing: keyof typeof EASING = 'easeInOut'
): Transition {
  if (prefersReducedMotion()) {
    return { duration: 0.01 };
  }
  return {
    duration: DURATIONS[duration],
    ease: EASING[easing],
  };
}

/**
 * Layout transition for height/position changes.
 */
export function getLayoutTransition(): Transition {
  if (prefersReducedMotion()) {
    return { duration: 0.01 };
  }
  return {
    type: 'spring',
    stiffness: 500,
    damping: 40,
    mass: 1,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Variant factories
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Expand/collapse variants for card bodies.
 * Uses opacity + height animation, respects reduced motion.
 */
export function getExpandCollapseVariants(): Variants {
  const reduced = prefersReducedMotion();
  return {
    collapsed: {
      opacity: 0,
      height: 0,
      overflow: 'hidden',
      transition: reduced
        ? { duration: 0.01 }
        : { duration: DURATIONS.fast, ease: EASING.easeIn },
    },
    expanded: {
      opacity: 1,
      height: 'auto',
      overflow: 'hidden',
      transition: reduced
        ? { duration: 0.01 }
        : { duration: DURATIONS.normal, ease: EASING.easeOut },
    },
  };
}

/**
 * Fade + slide variants for content swaps (e.g., running -> result).
 * With reduced motion: opacity only, no slide.
 */
export function getFadeSlideVariants(
  direction: 'up' | 'down' = 'up'
): Variants {
  const reduced = prefersReducedMotion();
  const distance = reduced ? 0 : DISTANCES.subtle;
  const yOffset = direction === 'up' ? distance : -distance;

  return {
    initial: {
      opacity: 0,
      y: yOffset,
    },
    animate: {
      opacity: 1,
      y: 0,
      transition: reduced
        ? { duration: 0.01 }
        : { duration: DURATIONS.fast, ease: EASING.easeOut },
    },
    exit: {
      opacity: 0,
      y: -yOffset,
      transition: reduced
        ? { duration: 0.01 }
        : { duration: DURATIONS.fast, ease: EASING.easeIn },
    },
  };
}

/**
 * Simple fade variants for container appear/disappear.
 */
export function getFadeVariants(): Variants {
  const reduced = prefersReducedMotion();
  return {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: reduced
        ? { duration: 0.01 }
        : { duration: DURATIONS.fast, ease: EASING.easeOut },
    },
    exit: {
      opacity: 0,
      transition: reduced
        ? { duration: 0.01 }
        : { duration: DURATIONS.fast, ease: EASING.easeIn },
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Pre-built static variants (for components that don't need dynamic config)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Static expand/collapse variants.
 * Note: These are evaluated at import time, so reduced motion preference
 * won't update dynamically. Use getExpandCollapseVariants() for dynamic checks.
 */
export const expandCollapseVariants = getExpandCollapseVariants();

/**
 * Static fade+slide variants (upward).
 */
export const fadeSlideUpVariants = getFadeSlideVariants('up');

/**
 * Static fade variants.
 */
export const fadeVariants = getFadeVariants();
