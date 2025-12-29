/**
 * Minimal test seam for mocking engine streaming.
 * In production, this wraps the real Tauri streaming runner.
 * In tests, allows injection via window.__ENDSTATE_MOCK_ENGINE__.
 */

import { runEndstateStreaming, StreamEvent, RunResult, StreamingOptions } from '../streaming-runner';
import { AppSettings } from '../settings';

// Test seam: allow mock injection in tests
declare global {
  interface Window {
    __ENDSTATE_MOCK_ENGINE__?: {
      runEndstateStreaming: typeof runEndstateStreaming;
    };
  }
}

/**
 * Wrapper around runEndstateStreaming that allows test mocking.
 * In production: calls real Tauri streaming runner.
 * In tests: uses mock if window.__ENDSTATE_MOCK_ENGINE__ is set.
 */
export async function runEngineStreaming<T>(
  settings: AppSettings,
  command: string,
  args: string[],
  onEvent: (event: StreamEvent) => void,
  options?: StreamingOptions
): Promise<RunResult<T>> {
  // Test seam: check for mock
  if (typeof window !== 'undefined' && window.__ENDSTATE_MOCK_ENGINE__) {
    return window.__ENDSTATE_MOCK_ENGINE__.runEndstateStreaming<T>(
      settings,
      command,
      args,
      onEvent,
      options
    );
  }

  // Production: use real streaming runner
  return runEndstateStreaming<T>(settings, command, args, onEvent, options);
}
