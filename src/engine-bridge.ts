/**
 * Engine Bridge
 * 
 * This module provides the interface for running the Autosuite CLI with
 * streaming NDJSON output. Events are received via Tauri event listeners.
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

/** Event channel name - must match Rust constant */
export const EVENT_CHANNEL = 'autosuite://event';

/** Log event from the engine */
export interface LogEvent {
  type: 'log';
  level: 'info' | 'warn' | 'error';
  message: string;
}

/** Result event (either from CLI or fallback) */
export interface ResultEvent {
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
  };
  raw: unknown | null;
}

/** CLI envelope result (from capabilities, apply, verify, etc.) */
export interface CliEnvelopeEvent {
  schemaVersion: string;
  cliVersion: string;
  command: string;
  runId: string;
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
 * @param exe - Path to the executable (typically "autosuite")
 * @param args - Command line arguments
 * @throws Error if the process fails to start
 */
export async function engineRun(exe: string, args: string[]): Promise<void> {
  await invoke('engine_run', { exe, args });
}

/**
 * Run autosuite capabilities command.
 */
export async function runCapabilities(): Promise<void> {
  await engineRun('autosuite', ['capabilities', '-Json']);
}

/**
 * Run autosuite verify command.
 * 
 * @param manifestPath - Path to the manifest file
 */
export async function runVerify(manifestPath: string): Promise<void> {
  await engineRun('autosuite', ['verify', manifestPath, '-Json']);
}

/**
 * Run autosuite apply command.
 * 
 * @param manifestPath - Path to the manifest file
 */
export async function runApply(manifestPath: string): Promise<void> {
  await engineRun('autosuite', ['apply', manifestPath, '-Json']);
}
