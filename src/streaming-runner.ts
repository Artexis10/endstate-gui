import { invoke, listen } from './lib/tauri-bridge';
import { EndstateEnvelope } from './types';
import { AppSettings } from './settings';

export interface StreamEvent {
  type: 'stdout' | 'stderr' | 'exit';
  data: string;
  exitCode?: number;
}

export interface RunResult<T> {
  envelope: EndstateEnvelope<T> | null;
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function runEndstateStreaming<T>(
  settings: AppSettings,
  command: string,
  args: string[],
  onEvent: (event: StreamEvent) => void
): Promise<RunResult<T>> {
  const fullArgs = [command, '--json', ...args];

  let exe: string;
  let execArgs: string[];

  if (settings.engineMode === 'bundled') {
    // Bundled mode: use 'endstate' from PATH (bundled with app)
    exe = 'endstate';
    execArgs = fullArgs;
  } else if (settings.engineMode === 'path') {
    exe = 'endstate';
    execArgs = fullArgs;
  } else {
    // Script mode
    exe = 'pwsh';
    execArgs = [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      settings.engineScriptPath,
      ...fullArgs,
    ];
  }

  const eventChannel = `endstate-stream-${Date.now()}`;
  let stdoutBuffer = '';
  let stderrBuffer = '';
  let exitCode = -1;

  const unlisten = await listen<StreamEvent>(eventChannel, (event) => {
    const payload = event.payload;
    onEvent(payload);

    if (payload.type === 'stdout') {
      stdoutBuffer += payload.data;
    } else if (payload.type === 'stderr') {
      stderrBuffer += payload.data;
    } else if (payload.type === 'exit') {
      exitCode = payload.exitCode ?? -1;
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
  }

  const stdout = stdoutBuffer.trim();
  let envelope: EndstateEnvelope<T> | null = null;

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
          try {
            const parsed = JSON.parse(jsonCandidate);
            // Validate it's an envelope (has required fields)
            if (parsed && typeof parsed === 'object' && 
                'schemaVersion' in parsed && 
                'command' in parsed && 
                'success' in parsed) {
              envelope = parsed as EndstateEnvelope<T>;
              break; // Successfully parsed valid envelope, stop searching
            }
          } catch {
            // Not valid JSON, continue searching backwards
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
  };
}
