import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVisualEventBuffer } from './use-visual-event-buffer';
import type { AppEvent } from '@/lib/apply-utils';

function makeEvent(app: string, statusKey?: string): AppEvent {
  return { app, action: 'OK', statusKey: statusKey as AppEvent['statusKey'], timestamp: Date.now() };
}

describe('useVisualEventBuffer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty when allEvents is empty', () => {
    const { result } = renderHook(() =>
      useVisualEventBuffer({ allEvents: [], rateMs: 200 }),
    );
    expect(result.current.visibleEvents).toEqual([]);
    expect(result.current.isDripping).toBe(false);
  });

  it('immediately reveals the first event', () => {
    const events = [makeEvent('git'), makeEvent('node'), makeEvent('vim')];
    const { result } = renderHook(() =>
      useVisualEventBuffer({ allEvents: events, rateMs: 200 }),
    );
    // First event is revealed immediately (no 200ms wait)
    expect(result.current.visibleEvents).toHaveLength(1);
    expect(result.current.visibleEvents[0].app).toBe('git');
    expect(result.current.isDripping).toBe(true);
  });

  it('reveals events one-by-one at rateMs intervals', () => {
    const events = [makeEvent('a'), makeEvent('b'), makeEvent('c'), makeEvent('d'), makeEvent('e')];
    const { result } = renderHook(() =>
      useVisualEventBuffer({ allEvents: events, rateMs: 200 }),
    );

    // After initial render: 1 event visible
    expect(result.current.visibleEvents).toHaveLength(1);

    // After 200ms: 2 events
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current.visibleEvents).toHaveLength(2);

    // After another 200ms: 3 events
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current.visibleEvents).toHaveLength(3);

    // After 400ms more: all 5 events
    act(() => { vi.advanceTimersByTime(400); });
    expect(result.current.visibleEvents).toHaveLength(5);
  });

  it('stops dripping when all events are revealed', () => {
    const events = [makeEvent('a'), makeEvent('b')];
    const { result } = renderHook(() =>
      useVisualEventBuffer({ allEvents: events, rateMs: 200 }),
    );

    expect(result.current.isDripping).toBe(true);

    // Reveal all
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current.visibleEvents).toHaveLength(2);
    expect(result.current.isDripping).toBe(false);

    // No further changes after more time
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.visibleEvents).toHaveLength(2);
  });

  it('resets when allEvents becomes empty', () => {
    const events = [makeEvent('a'), makeEvent('b'), makeEvent('c')];
    const { result, rerender } = renderHook(
      ({ allEvents }) => useVisualEventBuffer({ allEvents, rateMs: 200 }),
      { initialProps: { allEvents: events } },
    );

    // Reveal 2 events
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current.visibleEvents).toHaveLength(2);

    // Clear events (new run starts)
    rerender({ allEvents: [] });
    expect(result.current.visibleEvents).toEqual([]);
    expect(result.current.isDripping).toBe(false);
  });

  it('handles allEvents growing mid-drip', () => {
    const initial = [makeEvent('a'), makeEvent('b')];
    const { result, rerender } = renderHook(
      ({ allEvents }) => useVisualEventBuffer({ allEvents, rateMs: 200 }),
      { initialProps: { allEvents: initial } },
    );

    // 1 revealed initially
    expect(result.current.visibleEvents).toHaveLength(1);

    // Reveal second
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current.visibleEvents).toHaveLength(2);
    expect(result.current.isDripping).toBe(false);

    // Add more events (engine produces more)
    const grown = [...initial, makeEvent('c'), makeEvent('d')];
    rerender({ allEvents: grown });

    // Should start dripping the new events
    expect(result.current.isDripping).toBe(true);

    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current.visibleEvents).toHaveLength(3);

    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current.visibleEvents).toHaveLength(4);
    expect(result.current.isDripping).toBe(false);
  });

  it('uses custom rateMs', () => {
    const events = [makeEvent('a'), makeEvent('b'), makeEvent('c')];
    const { result } = renderHook(() =>
      useVisualEventBuffer({ allEvents: events, rateMs: 100 }),
    );

    expect(result.current.visibleEvents).toHaveLength(1);

    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current.visibleEvents).toHaveLength(2);

    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current.visibleEvents).toHaveLength(3);
  });

  it('can restart after reset with new events', () => {
    const first = [makeEvent('a'), makeEvent('b')];
    const { result, rerender } = renderHook(
      ({ allEvents }) => useVisualEventBuffer({ allEvents, rateMs: 200 }),
      { initialProps: { allEvents: first } },
    );

    // Reveal all first batch
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current.visibleEvents).toHaveLength(2);

    // Reset
    rerender({ allEvents: [] });
    expect(result.current.visibleEvents).toHaveLength(0);

    // New batch
    const second = [makeEvent('x'), makeEvent('y'), makeEvent('z')];
    rerender({ allEvents: second });

    // First event revealed immediately
    expect(result.current.visibleEvents).toHaveLength(1);
    expect(result.current.visibleEvents[0].app).toBe('x');

    act(() => { vi.advanceTimersByTime(400); });
    expect(result.current.visibleEvents).toHaveLength(3);
  });

  it('does not reset drip timer when new events arrive rapidly', () => {
    const events = [makeEvent('a')];
    const { result, rerender } = renderHook(
      ({ allEvents }) => useVisualEventBuffer({ allEvents, rateMs: 200 }),
      { initialProps: { allEvents: events } },
    );

    // First event revealed immediately
    expect(result.current.visibleEvents).toHaveLength(1);

    // Simulate rapid event arrivals every 50ms (faster than 200ms rate)
    // Each rerender adds one more event — the timer must NOT reset
    act(() => { vi.advanceTimersByTime(50); });
    rerender({ allEvents: [makeEvent('a'), makeEvent('b')] });

    act(() => { vi.advanceTimersByTime(50); });
    rerender({ allEvents: [makeEvent('a'), makeEvent('b'), makeEvent('c')] });

    act(() => { vi.advanceTimersByTime(50); });
    rerender({ allEvents: [makeEvent('a'), makeEvent('b'), makeEvent('c'), makeEvent('d')] });

    // 150ms total elapsed — still below 200ms, so only the initial event is visible
    expect(result.current.visibleEvents).toHaveLength(1);

    // After 50ms more (200ms total), timer fires and reveals one more
    act(() => { vi.advanceTimersByTime(50); });
    expect(result.current.visibleEvents).toHaveLength(2);

    // After another 200ms, reveals one more
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current.visibleEvents).toHaveLength(3);
  });
});
