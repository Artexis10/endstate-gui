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

/**
 * Engine version the mock claims. Deterministic rather than read from
 * ENGINE_VERSION: the mock stands in for a specific envelope shape, and tying
 * it to the pinned version would make E2E output change on every engine bump
 * without any shape change. The conformance test is what keeps it honest.
 */
const MOCK_ENGINE_VERSION = '2.24.2';

// Scenario definitions with deterministic outputs
/**
 * Builders that mirror the real apply envelope.
 *
 * The mock previously emitted `{ installed, alreadyPresent, failed, items }`
 * with no envelope wrapper — a shape the engine has never produced. Because
 * most E2E specs see only this mock, they confirmed the GUI's reading rather
 * than testing it, and three defects shipped behind green CI. The shape here is
 * pinned against a fixture captured from the real engine by
 * `tests/contract.test.js`; see `mock-engine.conformance.test.ts`.
 *
 * Field names and status vocabulary come from
 * `docs/contracts/cli-json-contract.md` in the engine repo: results live in
 * `actions[]`, aggregates in `summary`, and there is no `items` or `counts` on
 * an apply envelope.
 */
function action(overrides: {
  id: string;
  ref: string;
  name: string;
  status: 'to_install' | 'installed' | 'present' | 'failed';
  reason: string;
  message: string;
  version?: string;
}): Record<string, unknown> {
  return {
    id: overrides.id,
    ref: overrides.ref,
    driver: 'winget',
    name: overrides.name,
    status: overrides.status,
    reason: overrides.reason,
    message: overrides.message,
    version: overrides.version ?? '',
    manual: null,
  };
}

/**
 * Restore modules the mock apply envelope carries, defined as (module → the
 * entries resolved to it). entryCount is DERIVED from `entries.length` rather
 * than written separately, mirroring the engine invariant that membership and
 * count cannot disagree (a module with no resolved entries is omitted, never
 * reported empty). Deriving it from one source is why the count can never drift
 * from the entry list it claims to summarize.
 */
const MOCK_RESTORE_MODULES: Array<{ id: string; displayName: string; entries: string[] }> = [
  { id: 'apps.test-app-1', displayName: 'Test App 1', entries: ['settings.json', 'keybindings.json'] },
];

function restoreModulesAvailable(): Array<Record<string, unknown>> {
  return MOCK_RESTORE_MODULES.map((module) => ({
    id: module.id,
    displayName: module.displayName,
    entryCount: module.entries.length,
  }));
}

function applyEnvelope(input: {
  dryRun: boolean;
  summary: { total: number; success: number; skipped: number; failed: number };
  actions: Array<Record<string, unknown>>;
}): Record<string, unknown> {
  return {
    schemaVersion: '1.0',
    cliVersion: MOCK_ENGINE_VERSION,
    command: 'apply',
    runId: 'apply-e2e-mock',
    timestampUtc: BASE_TIMESTAMP,
    success: true,
    data: {
      dryRun: input.dryRun,
      manifest: { path: 'C:\\mock\\manifest.jsonc', name: 'mock-profile', hash: '' },
      summary: input.summary,
      actions: input.actions,
      configModuleMap: { 'Vendor.TestApp1': 'apps.test-app-1' },
      packageModuleMap: { 'winget:Vendor.TestApp1': ['apps.test-app-1'] },
      // Scoped to what a profile actually carries, with per-module entry counts
      // derived from a single source (see MOCK_RESTORE_MODULES).
      restoreModulesAvailable: restoreModulesAvailable(),
    },
    error: null,
  };
}

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
    envelope: applyEnvelope({
      dryRun: true,
      summary: { total: 2, success: 0, skipped: 1, failed: 0 },
      actions: [
        action({ id: 'app-1', ref: 'Vendor.TestApp1', name: 'Test App 1', status: 'to_install', reason: 'missing', message: 'Will be installed' }),
        action({ id: 'app-2', ref: 'Vendor.TestApp2', name: 'Test App 2', status: 'present', reason: 'already_installed', message: 'Already installed' }),
      ],
    }),
    exitCode: 0,
  },

  apply_ok_minimal: {
    events: [
      { type: 'phase', data: { phase: 'start', command: 'apply', timestamp: BASE_TIMESTAMP } },
      { type: 'item', data: { id: 'app-1', driver: 'winget', status: 'ok', reason: 'installed', name: 'Test App 1' } },
      { type: 'item', data: { id: 'app-2', driver: 'winget', status: 'ok', reason: 'already_installed', name: 'Test App 2' } },
      { type: 'phase', data: { phase: 'end', command: 'apply', timestamp: BASE_TIMESTAMP } },
    ],
    envelope: applyEnvelope({
      dryRun: false,
      summary: { total: 2, success: 1, skipped: 1, failed: 0 },
      actions: [
        action({ id: 'app-1', ref: 'Vendor.TestApp1', name: 'Test App 1', status: 'installed', reason: '', message: 'Installed successfully', version: '1.0.0' }),
        action({ id: 'app-2', ref: 'Vendor.TestApp2', name: 'Test App 2', status: 'present', reason: 'already_installed', message: 'Already installed' }),
      ],
    }),
    exitCode: 0,
  },

  apply_partial_fail: {
    events: [
      { type: 'phase', data: { phase: 'start', command: 'apply', timestamp: BASE_TIMESTAMP } },
      { type: 'item', data: { id: 'app-1', driver: 'winget', status: 'ok', reason: 'installed', name: 'Test App 1' } },
      { type: 'item', data: { id: 'app-2', driver: 'winget', status: 'error', reason: 'install_failed', name: 'Failed App', error: 'Package not found' } },
      { type: 'phase', data: { phase: 'end', command: 'apply', timestamp: BASE_TIMESTAMP } },
    ],
    envelope: applyEnvelope({
      dryRun: false,
      summary: { total: 2, success: 1, skipped: 0, failed: 1 },
      actions: [
        action({ id: 'app-1', ref: 'Vendor.TestApp1', name: 'Test App 1', status: 'installed', reason: '', message: 'Installed successfully', version: '1.0.0' }),
        action({ id: 'app-2', ref: 'Vendor.FailedApp', name: 'Failed App', status: 'failed', reason: 'install_failed', message: 'Package not found' }),
      ],
    }),
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
 * The envelope a scenario returns. Exported so the conformance test can assert
 * the mock's apply envelope against one captured from the real engine — the
 * mock is the only engine most E2E specs ever see, so nothing else stops it
 * drifting from the producer it stands in for.
 */
export function scenarioEnvelope(scenario: E2EScenario): any {
  return SCENARIOS[scenario].envelope;
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
