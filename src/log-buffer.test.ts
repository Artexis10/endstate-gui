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
    expect(onFlush).toHaveBeenCalledWith('chunk1chunk2chunk3', false);
  });

  it('flushes immediately when flush() is called', () => {
    const onFlush = vi.fn();
    const buffer = new LogBuffer(onFlush, 100);

    buffer.append('data1');
    buffer.append('data2');
    
    // Manually flush before timer expires
    buffer.flush();

    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush).toHaveBeenCalledWith('data1data2', false);

    // Timer should not trigger another flush
    vi.advanceTimersByTime(100);
    expect(onFlush).toHaveBeenCalledTimes(1);
  });

  it('applies cap to prevent unbounded memory growth', () => {
    const onFlush = vi.fn();
    const buffer = new LogBuffer(onFlush, 100);

    // Create a string larger than 2MB
    const largeChunk = 'x'.repeat(3 * 1024 * 1024);
    buffer.append(largeChunk);

    buffer.flush();

    // Should have been capped to 2MB and truncated flag set
    expect(onFlush).toHaveBeenCalledTimes(1);
    const flushedData = onFlush.mock.calls[0][0];
    const truncated = onFlush.mock.calls[0][1];
    expect(flushedData.length).toBe(2 * 1024 * 1024);
    expect(truncated).toBe(true);
    // Should keep the last 2MB (all 'x' characters)
    expect(flushedData).toBe('x'.repeat(2 * 1024 * 1024));
    expect(buffer.isTruncated()).toBe(true);
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
    expect(onFlush).toHaveBeenCalledWith('new data', false);
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
    expect(onFlush).toHaveBeenCalledWith('abcd', false);
  });

  it('handles multiple flush cycles correctly', () => {
    const onFlush = vi.fn();
    const buffer = new LogBuffer(onFlush, 100);

    // First cycle
    buffer.append('first');
    vi.advanceTimersByTime(100);
    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush).toHaveBeenCalledWith('first', false);

    // Second cycle
    buffer.append('second');
    vi.advanceTimersByTime(100);
    expect(onFlush).toHaveBeenCalledTimes(2);
    expect(onFlush).toHaveBeenCalledWith('second', false);
  });

  it('ensures pending buffer is flushed even if timer was scheduled', () => {
    const onFlush = vi.fn();
    const buffer = new LogBuffer(onFlush, 100);

    buffer.append('chunk1');
    buffer.append('chunk2');

    // Timer is scheduled but hasn't fired yet
    expect(onFlush).not.toHaveBeenCalled();

    // Manually flush before timer fires
    buffer.flush();

    // Should have flushed all pending data
    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush).toHaveBeenCalledWith('chunk1chunk2', false);

    // Timer firing should not cause another flush
    vi.advanceTimersByTime(100);
    expect(onFlush).toHaveBeenCalledTimes(1);
  });

  it('tracks truncation state across flushes', () => {
    const onFlush = vi.fn();
    const buffer = new LogBuffer(onFlush, 100);

    // First flush without truncation
    buffer.append('small');
    buffer.flush();
    expect(onFlush).toHaveBeenCalledWith('small', false);
    expect(buffer.isTruncated()).toBe(false);

    // Second flush with truncation
    const largeChunk = 'y'.repeat(3 * 1024 * 1024);
    buffer.append(largeChunk);
    buffer.flush();
    expect(onFlush.mock.calls[1][1]).toBe(true);
    expect(buffer.isTruncated()).toBe(true);

    // Truncation flag persists
    buffer.append('more');
    buffer.flush();
    expect(buffer.isTruncated()).toBe(true);
  });

  it('resets truncation flag on clear', () => {
    const onFlush = vi.fn();
    const buffer = new LogBuffer(onFlush, 100);

    // Trigger truncation
    const largeChunk = 'z'.repeat(3 * 1024 * 1024);
    buffer.append(largeChunk);
    buffer.flush();
    expect(buffer.isTruncated()).toBe(true);

    // Clear should reset flag
    buffer.clear();
    expect(buffer.isTruncated()).toBe(false);
  });
});
