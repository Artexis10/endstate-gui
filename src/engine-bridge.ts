/**
 * Engine Bridge
 * 
 * This module provides the interface for running the Autosuite CLI with
 * streaming NDJSON output. Events are received via Tauri event listeners.
 * 
 * Features:
 * - runId tagging for every event
 * - One-run-at-a-time guard
 * - Cancellation support
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

/** Event channel name - must match Rust constant */
export const EVENT_CHANNEL = 'autosuite://event';

/** Base event with runId (all events now include runId) */
interface BaseEvent {
  runId?: string;
}

/** Log event from the engine */
export interface LogEvent extends BaseEvent {
  type: 'log';
  level: 'info' | 'warn' | 'error';
  message: string;
}

/** Result event (either from CLI or fallback) */
export interface ResultEvent extends BaseEvent {
  type: 'result';
  ok: boolean;
  command: string;
  summary: {
    exitCode?: number;
    total?: number;
    success?: number;
    skipped?: number;
    failed?: number;
    pass?: number;
    fail?: number;
    cancelled?: boolean;
  };
  raw: unknown | null;
}

/** CLI envelope result (from capabilities, apply, verify, etc.) */
export interface CliEnvelopeEvent extends BaseEvent {
  schemaVersion: string;
  cliVersion: string;
  command: string;
  timestampUtc: string;
  success: boolean;
  data: unknown;
  error: {
    code: string;
    message: string;
    detail?: Record<string, unknown>;
    remediation?: string;
  } | null;
}

/** Union type for all possible engine events */
export type EngineEvent = LogEvent | ResultEvent | CliEnvelopeEvent | Record<string, unknown>;

/** Check if event is a log event */
export function isLogEvent(event: EngineEvent): event is LogEvent {
  return (event as LogEvent).type === 'log' && 'level' in event && 'message' in event;
}

/** Check if event is a result event (fallback type) */
export function isResultEvent(event: EngineEvent): event is ResultEvent {
  return (event as ResultEvent).type === 'result' && 'ok' in event;
}

/** Check if event is a CLI envelope (terminal result from CLI) */
export function isCliEnvelope(event: EngineEvent): event is CliEnvelopeEvent {
  return 'success' in event && 'command' in event && 'schemaVersion' in event;
}

/** Check if event represents a terminal result (either type) */
export function isTerminalResult(event: EngineEvent): boolean {
  return isResultEvent(event) || isCliEnvelope(event);
}

/**
 * Subscribe to engine events.
 * 
 * @param callback - Function to call for each event
 * @returns Unlisten function to stop receiving events
 */
export async function subscribeToEvents(
  callback: (event: EngineEvent) => void
): Promise<UnlistenFn> {
  return listen<EngineEvent>(EVENT_CHANNEL, (event) => {
    callback(event.payload);
  });
}

/**
 * Run the Autosuite CLI with streaming output.
 * 
 * Events will be emitted to the EVENT_CHANNEL and can be received
 * by subscribing with subscribeToEvents().
 * 
 * Only one run can be active at a time. If another run is in progress,
 * this function throws an error.
 * 
 * @param exe - Path to the executable (typically "autosuite")
 * @param args - Command line arguments
 * @returns The runId of the started run
 * @throws Error if the process fails to start or another run is active
 */
export async function engineRun(exe: string, args: string[]): Promise<string> {
  return invoke<string>('engine_run', { exe, args });
}

/**
 * Cancel the currently running engine process.
 * 
 * @throws Error if no run is active or cancellation fails
 */
export async function engineCancel(): Promise<void> {
  await invoke('engine_cancel');
}

/**
 * Check if an engine run is currently active.
 * 
 * @returns true if a run is in progress, false otherwise
 */
export async function engineIsRunning(): Promise<boolean> {
  return invoke<boolean>('engine_is_running');
}

/**
 * Get the current run ID if a run is active.
 * 
 * @returns The runId if a run is active, null otherwise
 */
export async function engineGetRunId(): Promise<string | null> {
  return invoke<string | null>('engine_get_run_id');
}

/**
 * Run autosuite capabilities command.
 * 
 * @returns The runId of the started run
 */
export async function runCapabilities(): Promise<string> {
  return engineRun('autosuite', ['capabilities', '-Json']);
}

/**
 * Run autosuite verify command.
 * 
 * @param manifestPath - Path to the manifest file
 * @returns The runId of the started run
 */
export async function runVerify(manifestPath: string): Promise<string> {
  return engineRun('autosuite', ['verify', manifestPath, '-Json']);
}

/**
 * Run autosuite apply command.
 * 
 * @param manifestPath - Path to the manifest file
 * @returns The runId of the started run
 */
export async function runApply(manifestPath: string): Promise<string> {
  return engineRun('autosuite', ['apply', manifestPath, '-Json']);
}
