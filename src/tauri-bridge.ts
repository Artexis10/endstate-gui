/**
 * Tauri Bridge
 * 
 * Platform-specific execution layer that invokes CLI commands via Tauri's
 * Rust backend. This module implements the executeCommand interface expected
 * by cli-bridge.ts.
 */

import { invoke } from '@tauri-apps/api/core';
import { parseCliOutput, isSchemaCompatible, CliEnvelope, CapabilitiesData } from './cli-bridge';

/**
 * Result from Rust CLI execution command.
 */
interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * CLI status states for the UI.
 */
export type CliStatus =
  | { state: 'checking' }
  | { state: 'ready'; cliVersion: string; schemaVersion: string }
  | { state: 'error'; error: string };

/**
 * Execute a CLI command via Tauri backend.
 * 
 * @param command - The CLI subcommand (e.g., 'capabilities', 'apply')
 * @param args - Additional arguments to pass to the command
 * @returns Parsed CLI envelope
 * @throws Error if execution fails or output is invalid
 */
export async function executeCommand<T>(
  command: string,
  args: string[] = []
): Promise<CliEnvelope<T>> {
  const fullArgs = [command, '--json', ...args];
  
  const result = await invoke<ExecResult>('autosuite_exec', {
    args: fullArgs,
  });

  if (result.exitCode !== 0 && !result.stdout) {
    throw new Error(
      result.stderr || `CLI exited with code ${result.exitCode}`
    );
  }

  return parseCliOutput<T>(result.stdout);
}

/**
 * Check CLI capabilities on startup.
 * Returns a status object suitable for UI display.
 */
export async function checkCliCapabilities(): Promise<CliStatus> {
  try {
    const envelope = await executeCommand<CapabilitiesData>('capabilities');

    if (!isSchemaCompatible(envelope.schemaVersion)) {
      return {
        state: 'error',
        error: `Schema version ${envelope.schemaVersion} is not compatible with this GUI (requires 1.0).`,
      };
    }

    return {
      state: 'ready',
      cliVersion: envelope.cliVersion,
      schemaVersion: envelope.schemaVersion,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    
    if (message.includes('not found') || message.includes('No such file')) {
      return {
        state: 'error',
        error: 'Autosuite CLI not found. Please ensure it is installed and available on PATH.',
      };
    }

    return {
      state: 'error',
      error: message,
    };
  }
}
