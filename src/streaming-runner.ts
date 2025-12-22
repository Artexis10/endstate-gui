import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { AutosuiteEnvelope } from './types';
import { AppSettings } from './settings';

export interface StreamEvent {
  type: 'stdout' | 'stderr' | 'exit';
  data: string;
  exitCode?: number;
}

export interface RunResult<T> {
  envelope: AutosuiteEnvelope<T> | null;
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function runAutosuiteStreaming<T>(
  settings: AppSettings,
  command: string,
  args: string[],
  onEvent: (event: StreamEvent) => void
): Promise<RunResult<T>> {
  const fullArgs = [command, '--json', ...args];

  let exe: string;
  let execArgs: string[];

  if (settings.engineMode === 'path') {
    exe = 'autosuite';
    execArgs = fullArgs;
  } else {
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

  const eventChannel = `autosuite-stream-${Date.now()}`;
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

  try {
    await invoke('run_autosuite_streaming', {
      exe,
      args: execArgs,
      eventChannel,
    });

    await new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        if (exitCode !== -1) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  } finally {
    unlisten();
  }

  const stdout = stdoutBuffer.trim();
  let envelope: AutosuiteEnvelope<T> | null = null;

  if (stdout && stdout.startsWith('{')) {
    try {
      envelope = JSON.parse(stdout) as AutosuiteEnvelope<T>;
    } catch (err) {
      console.error('Failed to parse JSON envelope:', err);
    }
  }

  return {
    envelope,
    exitCode,
    stdout,
    stderr: stderrBuffer,
  };
}
