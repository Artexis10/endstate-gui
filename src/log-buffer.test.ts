import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LogBuffer } from './log-buffer';

describe('LogBuffer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('buffers multiple chunks and flushes after interval', () => {
    const onFlush = vi.fn();
    const buffer = new LogBuffer(onFlush, 100);

    buffer.append('chunk1');
    buffer.append('chunk2');
    buffer.append('chunk3');

    // Should not have flushed yet
    expect(onFlush).not.toHaveBeenCalled();

    // Advance time to trigger flush
    vi.advanceTimersByTime(100);

    // Should have flushed once with all chunks combined
    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush).toHaveBeenCalledWith('chunk1chunk2chunk3');
  });

  it('flushes immediately when flush() is called', () => {
    const onFlush = vi.fn();
    const buffer = new LogBuffer(onFlush, 100);

    buffer.append('data1');
    buffer.append('data2');
    
    // Manually flush before timer expires
    buffer.flush();

    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush).toHaveBeenCalledWith('data1data2');

    // Timer should not trigger another flush
    vi.advanceTimersByTime(100);
    expect(onFlush).toHaveBeenCalledTimes(1);
  });

  it('applies cap to prevent unbounded memory growth', () => {
    const onFlush = vi.fn();
    const buffer = new LogBuffer(onFlush, 100);

    // Create a string larger than 256KB
    const largeChunk = 'x'.repeat(300 * 1024);
    buffer.append(largeChunk);

    buffer.flush();

    // Should have been capped to 256KB
    expect(onFlush).toHaveBeenCalledTimes(1);
    const flushedData = onFlush.mock.calls[0][0];
    expect(flushedData.length).toBe(256 * 1024);
    // Should keep the last 256KB (all 'x' characters)
    expect(flushedData).toBe('x'.repeat(256 * 1024));
  });

  it('clears buffer and cancels pending flush', () => {
    const onFlush = vi.fn();
    const buffer = new LogBuffer(onFlush, 100);

    buffer.append('data');
    buffer.clear();

    // Advance time - should not flush
    vi.advanceTimersByTime(100);
    expect(onFlush).not.toHaveBeenCalled();

    // Subsequent append should work normally
    buffer.append('new data');
    vi.advanceTimersByTime(100);
    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush).toHaveBeenCalledWith('new data');
  });

  it('does not flush empty buffer', () => {
    const onFlush = vi.fn();
    const buffer = new LogBuffer(onFlush, 100);

    buffer.flush();

    expect(onFlush).not.toHaveBeenCalled();
  });

  it('schedules only one flush timer for multiple appends', () => {
    const onFlush = vi.fn();
    const buffer = new LogBuffer(onFlush, 100);

    // Multiple appends in quick succession
    buffer.append('a');
    buffer.append('b');
    buffer.append('c');
    buffer.append('d');

    // Only one timer should be scheduled
    vi.advanceTimersByTime(100);
    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush).toHaveBeenCalledWith('abcd');
  });

  it('handles multiple flush cycles correctly', () => {
    const onFlush = vi.fn();
    const buffer = new LogBuffer(onFlush, 100);

    // First cycle
    buffer.append('first');
    vi.advanceTimersByTime(100);
    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush).toHaveBeenCalledWith('first');

    // Second cycle
    buffer.append('second');
    vi.advanceTimersByTime(100);
    expect(onFlush).toHaveBeenCalledTimes(2);
    expect(onFlush).toHaveBeenCalledWith('second');
  });
});
