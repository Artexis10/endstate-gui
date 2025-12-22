/**
 * Minimal test seam for mocking engine streaming.
 * In production, this wraps the real Tauri streaming runner.
 * In tests, allows injection via window.__AUTOSUITE_MOCK_ENGINE__.
 */

import { runAutosuiteStreaming, StreamEvent, RunResult } from '../streaming-runner';
import { AppSettings } from '../settings';

// Test seam: allow mock injection in tests
declare global {
  interface Window {
    __AUTOSUITE_MOCK_ENGINE__?: {
      runAutosuiteStreaming: typeof runAutosuiteStreaming;
    };
  }
}

/**
 * Wrapper around runAutosuiteStreaming that allows test mocking.
 * In production: calls real Tauri streaming runner.
 * In tests: uses mock if window.__AUTOSUITE_MOCK_ENGINE__ is set.
 */
export async function runEngineStreaming<T>(
  settings: AppSettings,
  command: string,
  args: string[],
  onEvent: (event: StreamEvent) => void
): Promise<RunResult<T>> {
  // Test seam: check for mock
  if (typeof window !== 'undefined' && window.__AUTOSUITE_MOCK_ENGINE__) {
    return window.__AUTOSUITE_MOCK_ENGINE__.runAutosuiteStreaming<T>(
      settings,
      command,
      args,
      onEvent
    );
  }

  // Production: use real streaming runner
  return runAutosuiteStreaming<T>(settings, command, args, onEvent);
}
