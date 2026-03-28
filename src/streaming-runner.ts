import { invoke, listen } from './lib/tauri-bridge';
import { EndstateEnvelope } from './types';
import { AppSettings } from './settings';
import { validateEngineScriptPath, getRepoRootFromScriptPath } from './lib/engine-path';
import {
  StreamingEvent as NdjsonEvent,
  StreamingEventBuffer,
  parseStreamingEvent,
} from './lib/streaming-events';

export interface StreamEvent {
  type: 'stdout' | 'stderr' | 'exit';
  data: string;
  exitCode?: number;
}

/**
 * Callback for NDJSON streaming events parsed from stderr.
 * These are UI-only events for live progress updates.
 */
export type NdjsonEventCallback = (event: NdjsonEvent) => void;

export interface RunResult<T> {
  envelope: EndstateEnvelope<T> | null;
  exitCode: number;
  stdout: string;
  stderr: string;
  ndjsonEvents: NdjsonEvent[];
}

// Global spawn counter for double-run validation (diagnostic only)
let globalSpawnCounter = 0;
const activeSpawns = new Map<string, { runId: string; command: string; startTime: number }>();

/**
 * Options for streaming execution.
 */
export interface StreamingOptions {
  /** Enable NDJSON streaming events from stderr */
  enableNdjsonEvents?: boolean;
  /** Callback for NDJSON events (only called if enableNdjsonEvents is true) */
  onNdjsonEvent?: NdjsonEventCallback;
}

export async function runEndstateStreaming<T>(
  settings: AppSettings,
  command: string,
  args: string[],
  onEvent: (event: StreamEvent) => void,
  options?: StreamingOptions
): Promise<RunResult<T>> {
  // Build args: always include --json for envelope output
  // Add --events jsonl if NDJSON streaming is enabled
  const fullArgs = options?.enableNdjsonEvents
    ? [command, '--json', '--events', 'jsonl', ...args]
    : [command, '--json', ...args];
  
  // Generate unique runId for this spawn
  const runId = `${command}-${Date.now()}-${++globalSpawnCounter}`;
  
  // Debug logging: detect double spawns
  if (import.meta.env.DEV) {
    const existingSpawns = Array.from(activeSpawns.values());
    if (existingSpawns.length > 0) {
      console.warn(`[SPAWN WARNING] New spawn ${runId} while ${existingSpawns.length} spawn(s) active:`, 
        existingSpawns.map(s => `${s.runId} (${s.command}, ${Date.now() - s.startTime}ms ago)`));
    }
    console.log(`[SPAWN START] runId=${runId}, command=${command}, args=${args.join(' ')}`);
    activeSpawns.set(runId, { runId, command, startTime: Date.now() });
  }

  let exe: string;
  let execArgs: string[];

  if (settings.engineMode === 'bundled') {
    // Bundled mode: delegate sidecar resolution to Rust via "__bundled__" sentinel
    exe = '__bundled__';
    execArgs = fullArgs;
    if (import.meta.env.DEV) {
      console.log(`[ENGINE] mode=bundled, exe=__bundled__ (sidecar resolved by Rust)`);
    }
  } else if (settings.engineMode === 'path') {
    exe = 'endstate';
    execArgs = fullArgs;
    if (import.meta.env.DEV) {
      console.log(`[ENGINE] mode=path, exe=endstate (from PATH)`);
    }
  } else {
    // Script mode: validate path exists before attempting execution
    const validationError = await validateEngineScriptPath(settings.engineScriptPath);
    if (validationError) {
      // Build helpful error message with bin/ suggestion
      const repoRoot = getRepoRootFromScriptPath(settings.engineScriptPath);
      const binPath = repoRoot ? `${repoRoot}\\bin\\endstate.ps1` : null;
      let errorMsg = validationError;
      if (binPath && !validationError.includes(binPath)) {
        errorMsg += `\nExpected location: ${binPath}`;
      }
      throw new Error(errorMsg);
    }
    
    exe = 'pwsh';
    execArgs = [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      settings.engineScriptPath,
      ...fullArgs,
    ];
    if (import.meta.env.DEV) {
      console.log(`[ENGINE] mode=script, exe=pwsh, scriptPath=${settings.engineScriptPath}`);
    }
  }

  const eventChannel = `endstate-stream-${Date.now()}`;
  let stdoutBuffer = '';
  let stderrBuffer = '';
  let exitCode = -1;
  
  // NDJSON event parsing from stderr
  const ndjsonBuffer = new StreamingEventBuffer();
  const ndjsonEvents: NdjsonEvent[] = [];
  const enableNdjson = options?.enableNdjsonEvents ?? false;
  const onNdjsonEvent = options?.onNdjsonEvent;

  const unlisten = await listen<StreamEvent>(eventChannel, (event) => {
    const payload = event.payload;
    onEvent(payload);

    if (payload.type === 'stdout') {
      stdoutBuffer += payload.data;
    } else if (payload.type === 'stderr') {
      stderrBuffer += payload.data;
      
      // Parse NDJSON events from stderr if enabled
      if (enableNdjson) {
        const events = ndjsonBuffer.append(payload.data);
        for (const evt of events) {
          ndjsonEvents.push(evt);
          onNdjsonEvent?.(evt);
        }
      }
    } else if (payload.type === 'exit') {
      exitCode = payload.exitCode ?? -1;
      
      // Flush any remaining NDJSON data
      if (enableNdjson) {
        const finalEvent = ndjsonBuffer.flush();
        if (finalEvent) {
          ndjsonEvents.push(finalEvent);
          onNdjsonEvent?.(finalEvent);
        }
      }
    }
  });

  // Timeout for streaming operations - capabilities needs shorter timeout to fail fast
  const isInitCommand = command === 'capabilities' || command === 'report';
  const timeoutMs = isInitCommand ? 10000 : 120000;
  
  try {
    // IMPORTANT: Tauri invoke() for streaming commands does NOT return a value.
    // In Tauri v2, invoke() commonly returns undefined even when streaming is active.
    // Do NOT treat undefined/null as runtime failure.
    // Only thrown errors indicate transport failure.
    // Streaming completion is determined by receiving an 'exit' event.
    await invoke('run_endstate_streaming', {
      exe,
      args: execArgs,
      eventChannel,
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Command '${command}' timed out after ${timeoutMs}ms. The engine may be unavailable or misconfigured.`));
      }, timeoutMs);
      
      const checkInterval = setInterval(() => {
        if (exitCode !== -1) {
          clearTimeout(timeout);
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  } finally {
    unlisten();
    // Debug logging: mark spawn complete
    if (import.meta.env.DEV) {
      const spawnInfo = activeSpawns.get(runId);
      if (spawnInfo) {
        const duration = Date.now() - spawnInfo.startTime;
        console.log(`[SPAWN END] runId=${runId}, duration=${duration}ms, exitCode=${exitCode}`);
        activeSpawns.delete(runId);
      }
    }
  }

  const stdout = stdoutBuffer.trim();
  let envelope: EndstateEnvelope<T> | null = null;

  // DEV: Log raw stdout length and last 500 chars for debugging truncation issues
  if (import.meta.env.DEV) {
    console.log(`[STREAMING] stdout length: ${stdout.length} chars`);
    console.log(`[STREAMING] stdout last 500 chars:`, stdout.slice(-500));
    
    // Write full stdout to debug file
    const debugTimestamp = Date.now();
    invoke<string>('write_text_file_debug', {
      filename: `ts-stdout-${command}-${debugTimestamp}.txt`,
      content: `=== TS STDOUT BUFFER (${stdout.length} chars) ===\n${stdout}`
    }).catch(e => console.error('[DEBUG] Failed to write stdout debug file:', e));
  }

  // Extract last JSON object from stdout (engine may output logs before JSON)
  if (stdout) {
    try {
      // Find the last occurrence of a JSON object in stdout
      const lines = stdout.split('\n');
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (line.startsWith('{')) {
          // Try to parse from this line to the end
          const jsonCandidate = lines.slice(i).join('\n');
          if (import.meta.env.DEV) {
            console.log(`[STREAMING] JSON candidate at line ${i}, length: ${jsonCandidate.length}, starts with: ${jsonCandidate.slice(0, 100)}`);
            
            // Write JSON candidate to debug file BEFORE parsing
            const debugTimestamp = Date.now();
            invoke<string>('write_text_file_debug', {
              filename: `ts-json-candidate-${command}-${debugTimestamp}.txt`,
              content: `=== JSON CANDIDATE (line ${i}, ${jsonCandidate.length} chars) ===\n${jsonCandidate}`
            }).catch(e => console.error('[DEBUG] Failed to write json candidate debug file:', e));
          }
          try {
            const parsed = JSON.parse(jsonCandidate);
            // Validate it's an envelope (has required fields)
            if (parsed && typeof parsed === 'object' && 
                'schemaVersion' in parsed && 
                'command' in parsed && 
                'success' in parsed) {
              envelope = parsed as EndstateEnvelope<T>;
              if (import.meta.env.DEV) {
                console.log(`[STREAMING] Parsed envelope, data keys:`, envelope.data ? Object.keys(envelope.data as object) : 'null');
                
                // Write parsed envelope to debug file
                const debugTimestamp = Date.now();
                invoke<string>('write_text_file_debug', {
                  filename: `ts-parsed-envelope-${command}-${debugTimestamp}.json`,
                  content: JSON.stringify(envelope, null, 2)
                }).catch(e => console.error('[DEBUG] Failed to write parsed envelope debug file:', e));
              }
              break; // Successfully parsed valid envelope, stop searching
            }
          } catch (parseErr) {
            // Not valid JSON, continue searching backwards
            if (import.meta.env.DEV) {
              console.log(`[STREAMING] JSON parse failed at line ${i}:`, parseErr);
              
              // Write parse error to debug file
              const debugTimestamp = Date.now();
              invoke<string>('write_text_file_debug', {
                filename: `ts-parse-error-${command}-${debugTimestamp}.txt`,
                content: `=== PARSE ERROR at line ${i} ===\nError: ${parseErr}\n\nCandidate:\n${jsonCandidate}`
              }).catch(e => console.error('[DEBUG] Failed to write parse error debug file:', e));
            }
            continue;
          }
        }
      }
    } catch (err) {
      console.error('Failed to extract JSON envelope from stdout:', err);
    }
  }

  return {
    envelope,
    exitCode,
    stdout,
    stderr: stderrBuffer,
    ndjsonEvents,
  };
}

/**
 * Helper to check if a line from stderr is a valid NDJSON event.
 * Useful for filtering raw stderr output.
 */
export function isNdjsonLine(line: string): boolean {
  return parseStreamingEvent(line) !== null;
}
