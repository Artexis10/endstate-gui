/**
 * Deterministic mock engine for E2E testing.
 * Provides scenario-based streaming responses with predictable outputs.
 * 
 * Usage in E2E tests:
 * 1. Set scenario: window.__endstate_e2e_setScenario('preview_ok_minimal')
 * 2. Trigger UI action (click Preview changes, etc.)
 * 3. Assert on deterministic output
 */

import type { AppSettings } from '../settings';
import type { StreamEvent, RunResult } from '../streaming-runner';
import { parseEventsFile, replayEvents } from '../lib/event-replay';
import fixtureContent from '../../e2e/fixtures/capture_ok_realistic.events.jsonl?raw';

// Scenario types
export type E2EScenario = 
  | 'preview_ok_minimal'
  | 'apply_ok_minimal'
  | 'apply_partial_fail'
  | 'verify_missing_apps'
  | 'report_empty'
  | 'capture_ok_minimal'
  | 'capture_ok_replay'
  | 'capabilities_ok';

// Deterministic timestamps for stable tests
const BASE_TIMESTAMP = '2025-01-01T00:00:00.000Z';

// Scenario definitions with deterministic outputs
const SCENARIOS: Record<E2EScenario, {
  events: Array<{ type: 'item' | 'phase' | 'artifact'; data: any }>;
  envelope: any;
  exitCode: number;
}> = {
  preview_ok_minimal: {
    events: [
      { type: 'phase', data: { phase: 'start', command: 'apply', timestamp: BASE_TIMESTAMP } },
      { type: 'item', data: { id: 'app-1', driver: 'winget', status: 'ok', reason: 'would_install', name: 'Test App 1' } },
      { type: 'item', data: { id: 'app-2', driver: 'winget', status: 'ok', reason: 'already_installed', name: 'Test App 2' } },
      { type: 'phase', data: { phase: 'end', command: 'apply', timestamp: BASE_TIMESTAMP } },
    ],
    envelope: {
      success: true,
      data: {
        installed: 1,
        alreadyPresent: 1,
        failed: 0,
        items: [
          { id: 'app-1', driver: 'winget', status: 'ok', reason: 'would_install', name: 'Test App 1' },
          { id: 'app-2', driver: 'winget', status: 'ok', reason: 'already_installed', name: 'Test App 2' },
        ],
      },
    },
    exitCode: 0,
  },

  apply_ok_minimal: {
    events: [
      { type: 'phase', data: { phase: 'start', command: 'apply', timestamp: BASE_TIMESTAMP } },
      { type: 'item', data: { id: 'app-1', driver: 'winget', status: 'ok', reason: 'installed', name: 'Test App 1' } },
      { type: 'item', data: { id: 'app-2', driver: 'winget', status: 'ok', reason: 'already_installed', name: 'Test App 2' } },
      { type: 'phase', data: { phase: 'end', command: 'apply', timestamp: BASE_TIMESTAMP } },
    ],
    envelope: {
      success: true,
      data: {
        installed: 1,
        alreadyPresent: 1,
        failed: 0,
        items: [
          { id: 'app-1', driver: 'winget', status: 'ok', reason: 'installed', name: 'Test App 1' },
          { id: 'app-2', driver: 'winget', status: 'ok', reason: 'already_installed', name: 'Test App 2' },
        ],
      },
    },
    exitCode: 0,
  },

  apply_partial_fail: {
    events: [
      { type: 'phase', data: { phase: 'start', command: 'apply', timestamp: BASE_TIMESTAMP } },
      { type: 'item', data: { id: 'app-1', driver: 'winget', status: 'ok', reason: 'installed', name: 'Test App 1' } },
      { type: 'item', data: { id: 'app-2', driver: 'winget', status: 'error', reason: 'install_failed', name: 'Failed App', error: 'Package not found' } },
      { type: 'phase', data: { phase: 'end', command: 'apply', timestamp: BASE_TIMESTAMP } },
    ],
    envelope: {
      success: true,
      data: {
        installed: 1,
        alreadyPresent: 0,
        failed: 1,
        items: [
          { id: 'app-1', driver: 'winget', status: 'ok', reason: 'installed', name: 'Test App 1' },
          { id: 'app-2', driver: 'winget', status: 'error', reason: 'install_failed', name: 'Failed App', error: 'Package not found' },
        ],
      },
    },
    exitCode: 0,
  },

  verify_missing_apps: {
    events: [
      { type: 'phase', data: { phase: 'start', command: 'verify', timestamp: BASE_TIMESTAMP } },
      { type: 'item', data: { id: 'app-1', driver: 'winget', status: 'ok', reason: 'present', name: 'Present App' } },
      { type: 'item', data: { id: 'app-2', driver: 'winget', status: 'missing', reason: 'not_installed', name: 'Missing App' } },
      { type: 'phase', data: { phase: 'end', command: 'verify', timestamp: BASE_TIMESTAMP } },
    ],
    envelope: {
      success: true,
      data: {
        present: 1,
        missing: 1,
        items: [
          { id: 'app-1', driver: 'winget', status: 'ok', reason: 'present', name: 'Present App' },
          { id: 'app-2', driver: 'winget', status: 'missing', reason: 'not_installed', name: 'Missing App' },
        ],
      },
    },
    exitCode: 0,
  },

  report_empty: {
    events: [],
    envelope: {
      success: true,
      data: {
        hasState: false,
      },
    },
    exitCode: 0,
  },

  capture_ok_minimal: {
    events: [
      { type: 'phase', data: { phase: 'start', command: 'capture', timestamp: BASE_TIMESTAMP } },
      { type: 'item', data: { id: 'app-1', driver: 'winget', name: 'Captured App 1' } },
      { type: 'item', data: { id: 'app-2', driver: 'winget', name: 'Captured App 2' } },
      { type: 'phase', data: { phase: 'end', command: 'capture', timestamp: BASE_TIMESTAMP } },
    ],
    envelope: {
      schemaVersion: '1.0',
      cliVersion: '0.0.0-dev',
      command: 'capture',
      timestampUtc: BASE_TIMESTAMP,
      success: true,
      data: {
        outputPath: 'C:\\test\\profiles\\captured.jsonc',
        isExample: null,
        sanitized: false,
        counts: {
          totalFound: 2,
          included: 2,
          skipped: 0,
          filteredRuntimes: 0,
          filteredStoreApps: 0,
          sensitiveExcludedCount: 0,
        },
        appsIncluded: [
          { id: 'app-1', source: 'winget' },
          { id: 'app-2', source: 'winget' },
        ],
      },
      error: null,
    },
    exitCode: 0,
  },

  capabilities_ok: {
    events: [],
    envelope: {
      success: true,
      data: {
        version: '1.0.0',
        drivers: ['winget', 'scoop'],
        features: [],
        commands: ['capture', 'apply', 'verify', 'report'],
      },
    },
    exitCode: 0,
  },

  capture_ok_replay: {
    events: [],
    envelope: {},
    exitCode: 0,
  },
};

// Get current scenario from window
function getCurrentScenario(): E2EScenario {
  if (typeof window !== 'undefined' && (window as any).__ENDSTATE_E2E_SCENARIO__) {
    return (window as any).__ENDSTATE_E2E_SCENARIO__ as E2EScenario;
  }
  return 'preview_ok_minimal'; // Default scenario
}

// Get scenario for a specific command
function getScenarioForCommand(command: string, args: string[]): E2EScenario {
  // Check if a specific scenario is set
  const explicitScenario = getCurrentScenario();
  if (explicitScenario !== 'preview_ok_minimal') {
    return explicitScenario;
  }

  // Auto-select based on command
  switch (command) {
    case 'capabilities':
      return 'capabilities_ok';
    case 'apply':
      // Check for dry-run flag
      if (args.includes('--dry-run')) {
        return 'preview_ok_minimal';
      }
      return 'apply_ok_minimal';
    case 'verify':
      return 'verify_missing_apps';
    case 'report':
      return 'report_empty';
    case 'capture':
      return 'capture_ok_minimal';
    default:
      return 'preview_ok_minimal';
  }
}

/**
 * Deterministic mock engine for E2E testing.
 * Emits events synchronously (with minimal delay for UI updates) and returns predictable envelopes.
 */
export async function runEndstateStreaming<T>(
  _settings: AppSettings,
  command: string,
  args: string[],
  onEvent?: (event: StreamEvent) => void,
  _options?: { onNdjsonEvent?: (event: any) => void }
): Promise<RunResult<T>> {
  const scenario = getScenarioForCommand(command, args);
  const scenarioData = SCENARIOS[scenario];

  if (!scenarioData) {
    console.warn(`[E2E Mock] Unknown scenario: ${scenario}, using preview_ok_minimal`);
    return runEndstateStreaming(_settings, command, args, onEvent, _options);
  }

  // Special handling for replay scenario
  if (scenario === 'capture_ok_replay') {
    const events = parseEventsFile(fixtureContent);
    const { counters } = replayEvents(events);

    // Emit parsed events
    for (const event of events) {
      if (_options?.onNdjsonEvent) {
        _options.onNdjsonEvent(event);
      }
      
      if (onEvent) {
        onEvent({ type: 'stdout', data: JSON.stringify(event) + '\n' });
      }
      
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Extract item events for appsIncluded
    const itemEvents = events.filter(e => e.event === 'item') as Array<{ id: string; driver: string }>;

    // Build envelope from replayed data
    const envelope = {
      schemaVersion: '1.0',
      cliVersion: '0.0.0-dev',
      command: 'capture',
      timestampUtc: '2025-01-01T00:00:00.000Z',
      success: true,
      data: {
        outputPath: 'C:\\test\\profiles\\captured.jsonc',
        isExample: null,
        sanitized: false,
        counts: {
          totalFound: itemEvents.length,
          included: itemEvents.length,
          skipped: counters.skipped,
          filteredRuntimes: 0,
          filteredStoreApps: 0,
          sensitiveExcludedCount: 0,
        },
        appsIncluded: itemEvents.map(item => ({
          id: item.id,
          source: item.driver,
        })),
      },
      error: null,
    };

    const stdout = JSON.stringify(envelope);

    return {
      exitCode: 0,
      stdout,
      stderr: '',
      envelope: envelope as any,
      ndjsonEvents: events,
    };
  }

  // Emit events with minimal delay for UI to process
  for (const event of scenarioData.events) {
    // Emit as NDJSON event if handler provided
    if (_options?.onNdjsonEvent) {
      _options.onNdjsonEvent(event.data);
    }
    
    // Also emit as stdout for compatibility
    if (onEvent) {
      onEvent({ type: 'stdout', data: JSON.stringify(event.data) + '\n' });
    }
    
    // Minimal delay to allow UI to process (keeps tests fast but deterministic)
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  // Build stdout from envelope
  const stdout = JSON.stringify(scenarioData.envelope);

  return {
    exitCode: scenarioData.exitCode,
    stdout,
    stderr: '',
    envelope: scenarioData.envelope as any,
    ndjsonEvents: scenarioData.events.map(e => e.data),
  };
}

/**
 * Mock for runEndstateOnce (non-streaming version)
 */
export async function runEndstateOnce<T>(
  settings: AppSettings,
  command: string,
  args: string[]
): Promise<RunResult<T>> {
  return runEndstateStreaming<T>(settings, command, args);
}

/**
 * Install the mock engine on window for E2E tests.
 * Call this during app initialization when in E2E mode.
 */
export function installMockEngine(): void {
  if (typeof window === 'undefined') return;

  (window as any).__ENDSTATE_MOCK_ENGINE__ = {
    runEndstateStreaming,
    runEndstateOnce,
  };

  // Install scenario setter hook
  (window as any).__endstate_e2e_setScenario = (scenario: E2EScenario) => {
    (window as any).__ENDSTATE_E2E_SCENARIO__ = scenario;
  };

  console.log('[E2E] Deterministic mock engine installed');
}

/**
 * Check if we're in E2E mode.
 * Supports query param (?e2e=1) and environment variable.
 */
export function isE2EMode(): boolean {
  if (typeof window === 'undefined') return false;

  // Check query param
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('e2e') === '1') {
    return true;
  }

  // Check if mock engine is already installed (by test harness)
  if ((window as any).__ENDSTATE_MOCK_ENGINE__) {
    return true;
  }

  // Check Vite env var
  if (import.meta.env?.VITE_E2E === '1' || import.meta.env?.MODE === 'test') {
    return true;
  }

  return false;
}
