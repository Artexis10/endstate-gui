/**
 * Non-streaming engine execution for one-shot commands like capabilities.
 * 
 * This module provides typed errors and proper handling for both Tauri and web modes.
 */

import { invoke, isEngineAvailable } from './tauri-bridge';
import { AppSettings } from '../settings';
import { validateEngineScriptPath, getRepoRootFromScriptPath } from './engine-path';

/** Typed error kinds for engine execution */
export type EngineErrorKind = 
  | 'engine_unavailable_web'  // Running in web mode without mock
  | 'command_failed'          // Command executed but failed (non-zero exit, parse error)
  | 'command_not_found'       // endstate binary not found
  | 'invoke_failed'           // Tauri invoke failed
  | 'verify_failed';          // Domain failure: verify found missing apps/mismatches (not a runtime error)

export interface EngineError {
  kind: EngineErrorKind;
  message: string;
  command?: string;
  exitCode?: number;
  stderr?: string;
  details?: string;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Result of building an engine command.
 * Contains the executable, arguments, and display string for diagnostics.
 */
export interface EngineCommand {
  exe: string;
  args: string[];
  displayCommand: string;
}

/**
 * Build the engine command based on settings and mode.
 *
 * For script mode: exe="pwsh", args include -NoProfile -ExecutionPolicy Bypass -File <scriptPath>
 * For bundled mode: exe="powershell.exe" with bundled engine path (production), or "endstate" PATH fallback (dev)
 * For path mode: exe="endstate", args are passed directly
 *
 * @param settings - App settings containing engineMode and engineScriptPath
 * @param commandArgs - Arguments to pass to the engine (e.g., ["capabilities", "--json"])
 * @returns EngineCommand with exe, args, and displayCommand
 */
export async function buildEngineCommand(
  settings: AppSettings,
  commandArgs: string[]
): Promise<EngineCommand> {
  if (settings.engineMode === 'script') {
    const exe = 'pwsh';
    const args = [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      settings.engineScriptPath,
      ...commandArgs,
    ];
    const displayCommand = `pwsh -NoProfile -ExecutionPolicy Bypass -File "${settings.engineScriptPath}" ${commandArgs.join(' ')}`;
    return { exe, args, displayCommand };
  } else if (settings.engineMode === 'bundled') {
    // Try to get bundled engine path from Rust backend
    const bundledPath = await invoke<string | null>('get_bundled_engine_path');
    if (bundledPath) {
      // Production: use bundled engine via PowerShell
      const exe = 'powershell.exe';
      const args = [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        bundledPath,
        ...commandArgs,
      ];
      return { exe, args, displayCommand: `[bundled] ${commandArgs.join(' ')}` };
    } else {
      // Dev fallback: use PATH
      return { exe: 'endstate', args: commandArgs, displayCommand: `endstate ${commandArgs.join(' ')}` };
    }
  } else {
    // path mode
    return { exe: 'endstate', args: commandArgs, displayCommand: `endstate ${commandArgs.join(' ')}` };
  }
}

export type EngineExecResult<T> = {
  success: true;
  envelope: T;
  stdout: string;
  stderr: string;
  exitCode: number;
} | {
  success: false;
  error: EngineError;
  envelope?: T;  // May be present for domain failures (e.g., VERIFY_FAILED has valid data)
  stdout?: string;
  stderr?: string;
  exitCode?: number;
}

/** Mock capabilities response for web mode with mock enabled */
const MOCK_CAPABILITIES = {
  schemaVersion: '1.0',
  cliVersion: 'mock-1.0.0',
  command: 'capabilities',
  runId: 'mock-run',
  timestampUtc: new Date().toISOString(),
  success: true,
  data: {
    supportedSchemaVersions: { min: '1.0', max: '1.0' },
    commands: ['capabilities', 'verify', 'apply', 'capture', 'report'],
  },
};

/**
 * Check if mock engine is enabled (for web mode testing).
 */
function hasMockEngine(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as any).__ENDSTATE_MOCK_ENGINE__;
}

/**
 * Run an endstate command once (non-streaming).
 * 
 * In Tauri runtime: executes via endstate_exec command
 * In web runtime with mock: returns mock response
 * In web runtime without mock: returns typed error
 */
export async function runEndstateOnce<T>(
  settings: AppSettings,
  command: string,
  args: string[] = []
): Promise<EngineExecResult<T>> {
  const fullArgs = [command, '--json', ...args];
  const engineCmd = await buildEngineCommand(settings, fullArgs);
  const commandStr = engineCmd.displayCommand;
  
  // Check if we're in web mode without engine access
  if (!isEngineAvailable()) {
    // Web mode - check for mock
    if (hasMockEngine()) {
      // Use mock engine
      const mockEngine = (window as any).__ENDSTATE_MOCK_ENGINE__;
      if (mockEngine.runEndstateOnce) {
        return mockEngine.runEndstateOnce(settings, command, args);
      }
      // Fallback: return mock capabilities for capabilities command
      if (command === 'capabilities') {
        return {
          success: true,
          envelope: MOCK_CAPABILITIES as T,
          stdout: JSON.stringify(MOCK_CAPABILITIES),
          stderr: '',
          exitCode: 0,
        };
      }
    }
    
    // Web mode without mock - return typed error
    return {
      success: false,
      error: {
        kind: 'engine_unavailable_web',
        message: 'Engine not available in web mode. Enable mock mode or run in Tauri.',
        command: commandStr,
      },
    };
  }
  
  // Tauri runtime - execute via endstate_exec
  // Script mode validation: check path exists before attempting execution
  if (settings.engineMode === 'script') {
    const validationError = await validateEngineScriptPath(settings.engineScriptPath);
    if (validationError) {
      return {
        success: false,
        error: {
          kind: 'command_not_found',
          message: validationError,
          command: commandStr,
          details: `Configured path: ${settings.engineScriptPath}`,
        },
      };
    }
  }
  
  try {
    const result = await invoke<ExecResult>('endstate_exec', {
      exe: engineCmd.exe,
      args: engineCmd.args,
    });
    
    // Check for command not found (typically exit code 1 with specific stderr)
    if (result.exitCode !== 0) {
      const isNotFound = result.stderr?.includes('not recognized') || 
                         result.stderr?.includes('not found') ||
                         result.stderr?.includes('CommandNotFoundException');
      
      if (isNotFound) {
        // Build helpful error message
        let message = 'endstate command not found.';
        if (settings.engineMode === 'script') {
          const repoRoot = getRepoRootFromScriptPath(settings.engineScriptPath);
          const binPath = repoRoot ? `${repoRoot}\\bin\\endstate.ps1` : null;
          message = `Engine script not found at: ${settings.engineScriptPath}`;
          if (binPath && settings.engineScriptPath !== binPath) {
            message += `\nThe engine may have moved to: ${binPath}`;
          }
        } else {
          message = 'endstate command not found. Check that it is installed and in PATH.';
        }
        
        return {
          success: false,
          error: {
            kind: 'command_not_found',
            message,
            command: commandStr,
            exitCode: result.exitCode,
            stderr: result.stderr,
          },
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
        };
      }
      
      return {
        success: false,
        error: {
          kind: 'command_failed',
          message: `Command failed with exit code ${result.exitCode}`,
          command: commandStr,
          exitCode: result.exitCode,
          stderr: result.stderr,
        },
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      };
    }
    
    // Parse JSON from stdout
    if (!result.stdout || !result.stdout.trim()) {
      return {
        success: false,
        error: {
          kind: 'command_failed',
          message: 'Command produced no output',
          command: commandStr,
          exitCode: result.exitCode,
          stderr: result.stderr,
        },
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      };
    }
    
    // Find JSON in stdout (may have log lines before it)
    const lines = result.stdout.split('\n');
    let jsonStr = '';
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.startsWith('{')) {
        jsonStr = lines.slice(i).join('\n');
        break;
      }
    }
    
    if (!jsonStr) {
      return {
        success: false,
        error: {
          kind: 'command_failed',
          message: 'No JSON found in command output',
          command: commandStr,
          exitCode: result.exitCode,
          details: result.stdout.substring(0, 200),
        },
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      };
    }
    
    try {
      const envelope = JSON.parse(jsonStr) as T;
      
      // Check if the envelope itself indicates a domain failure (e.g., VERIFY_FAILED)
      // These are not runtime errors - the command executed successfully but found issues
      const envelopeObj = envelope as Record<string, unknown>;
      if (envelopeObj.success === false && envelopeObj.error) {
        const errorObj = envelopeObj.error as { code?: string; message?: string };
        // Domain failure - include envelope so caller can access the data
        return {
          success: false,
          error: {
            kind: errorObj.code === 'VERIFY_FAILED' ? 'verify_failed' : 'command_failed',
            message: errorObj.message || 'Command returned failure',
            command: commandStr,
            exitCode: result.exitCode,
          },
          envelope,  // Include envelope for domain failures - data is still valid
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
        };
      }
      
      return {
        success: true,
        envelope,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      };
    } catch (parseErr) {
      return {
        success: false,
        error: {
          kind: 'command_failed',
          message: `Failed to parse JSON: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
          command: commandStr,
          exitCode: result.exitCode,
          details: jsonStr.substring(0, 200),
        },
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      };
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    
    // Check if it's a "not found" type error
    if (errMsg.includes('not found') || errMsg.includes('not recognized')) {
      return {
        success: false,
        error: {
          kind: 'command_not_found',
          message: 'endstate command not found. Check that it is installed and in PATH.',
          command: commandStr,
          details: errMsg,
        },
      };
    }
    
    return {
      success: false,
      error: {
        kind: 'invoke_failed',
        message: `Failed to execute command: ${errMsg}`,
        command: commandStr,
        details: errMsg,
      },
    };
  }
}

/**
 * Get a user-friendly error message for display.
 */
export function getErrorMessage(error: EngineError): string {
  switch (error.kind) {
    case 'engine_unavailable_web':
      return 'Engine not available in web mode. Enable mock mode for testing, or run the app in Tauri.';
    case 'command_not_found':
      return 'endstate command not found. Please install endstate or configure the script path in Settings.';
    case 'command_failed':
      return error.message;
    case 'invoke_failed':
      return `Failed to run command: ${error.message}`;
    default:
      return error.message;
  }
}
