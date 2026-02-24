/**
 * useVisualEventBuffer — Presentation-layer drip feed for streaming events.
 *
 * Reveals events one at a time at a configurable rate (default 200ms = ~5/sec),
 * giving the live activity panel a satisfying sequential reveal even when the
 * engine processes apps instantly.
 *
 * Uses wall-clock time so the count catches up even when React re-renders are
 * slow or the main thread is busy. Each tick calculates the expected reveal
 * count from elapsed time rather than incrementing by 1, avoiding drift.
 *
 * The buffer is transparent to consumers — they receive a growing slice of the
 * same AppEvent array that App.tsx produces.
 */

import { useEffect, useRef, useState } from 'react';
import type { AppEvent } from '@/lib/apply-utils';

interface UseVisualEventBufferOptions {
  /** All events from the upstream source (App.tsx liveAppEvents). */
  allEvents: AppEvent[];
  /** Milliseconds between revealing each event. Default: 200 (5 events/sec). */
  rateMs?: number;
}

interface UseVisualEventBufferReturn {
  /** The slice of allEvents currently revealed to the UI. */
  visibleEvents: AppEvent[];
  /** Whether there are still unrevealed events being dripped. */
  isDripping: boolean;
}

export function useVisualEventBuffer({
  allEvents,
  rateMs = 200,
}: UseVisualEventBufferOptions): UseVisualEventBufferReturn {
  const [dripCount, setDripCount] = useState(0);
  const dripStartRef = useRef(0);
  const currentLengthRef = useRef(0);

  const currentLength = allEvents.length;
  currentLengthRef.current = currentLength;

  // Record drip start when first event arrives
  if (currentLength > 0 && dripStartRef.current === 0) {
    dripStartRef.current = Date.now();
  }
  // Reset when events are cleared (new run)
  if (currentLength === 0 && dripStartRef.current !== 0) {
    dripStartRef.current = 0;
  }

  // Immediately reveal the first event (no 200ms blank stare).
  // Calling setState during render is a valid React pattern — React
  // restarts the render with the new state. Converges because
  // the condition (dripCount === 0) will be false on the re-render.
  if (currentLength > 0 && dripCount === 0) {
    setDripCount(1);
  }

  // Stable interval that fires every rateMs. Uses a ref for currentLength
  // so the interval doesn't restart when new events arrive mid-drip.
  // The wall-clock calculation inside the callback handles catchup naturally.
  useEffect(() => {
    if (currentLength === 0 || dripStartRef.current === 0) return;

    const timer = setInterval(() => {
      const elapsed = Date.now() - dripStartRef.current;
      const target = currentLengthRef.current;
      const shouldShow = Math.min(Math.floor(elapsed / rateMs) + 1, target);
      setDripCount((prev) => Math.max(prev, shouldShow));
    }, rateMs);

    return () => clearInterval(timer);
  }, [currentLength === 0, rateMs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset dripCount when events are cleared
  useEffect(() => {
    if (currentLength === 0) setDripCount(0);
  }, [currentLength === 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const clamped = Math.min(dripCount, currentLength);
  const visibleEvents = currentLength === 0 ? allEvents : allEvents.slice(0, clamped);
  const isDripping = clamped < currentLength;

  return { visibleEvents, isDripping };
}
