/**
 * Buffered log accumulator with throttled flushing to reduce React re-renders.
 * 
 * Collects incoming log chunks and flushes to a callback at a fixed interval,
 * dramatically reducing the number of state updates during streaming operations.
 */

const MAX_LOG_CHARS = 256 * 1024; // 256KB cap

export class LogBuffer {
  private buffer = '';
  private flushTimer: number | null = null;
  private readonly flushIntervalMs: number;
  private readonly onFlush: (logs: string) => void;
  private isFlushing = false;

  constructor(onFlush: (logs: string) => void, flushIntervalMs = 100) {
    this.onFlush = onFlush;
    this.flushIntervalMs = flushIntervalMs;
  }

  /**
   * Append a chunk of log data to the buffer.
   * Schedules a flush if not already scheduled.
   */
  append(chunk: string): void {
    this.buffer += chunk;

    // Schedule flush if not already scheduled
    if (this.flushTimer === null && !this.isFlushing) {
      this.flushTimer = window.setTimeout(() => {
        this.flush();
      }, this.flushIntervalMs);
    }
  }

  /**
   * Immediately flush the buffer to the callback.
   * Applies cap to prevent unbounded memory growth.
   */
  flush(): void {
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.buffer.length === 0) {
      return;
    }

    this.isFlushing = true;

    // Apply cap: keep last N chars
    let toFlush = this.buffer;
    if (toFlush.length > MAX_LOG_CHARS) {
      toFlush = toFlush.slice(-MAX_LOG_CHARS);
    }

    this.onFlush(toFlush);
    this.buffer = '';
    this.isFlushing = false;
  }

  /**
   * Clear the buffer and cancel any pending flush.
   */
  clear(): void {
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.buffer = '';
    this.isFlushing = false;
  }
}
