import { invoke } from './lib/tauri-bridge';
import { AutosuiteEnvelope } from './types';

interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface RunAutosuiteResult<T> {
  envelope: AutosuiteEnvelope<T> | null;
  exitCode: number;
  stderr: string;
  rawStdout: string;
}

export async function runAutosuite<T>(
  command: string,
  args: string[] = []
): Promise<RunAutosuiteResult<T>> {
  const fullArgs = [command, '--json', ...args];

  let result: ExecResult;
  try {
    result = await invoke<ExecResult>('autosuite_exec', {
      args: fullArgs,
    });
  } catch (err) {
    throw new Error(
      `Failed to execute autosuite: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const stdout = result.stdout.trim();
  const stderr = result.stderr.trim();
  const exitCode = result.exitCode;

  if (!stdout || !stdout.startsWith('{')) {
    return {
      envelope: null,
      exitCode,
      stderr,
      rawStdout: stdout,
    };
  }

  let envelope: AutosuiteEnvelope<T>;
  try {
    envelope = JSON.parse(stdout) as AutosuiteEnvelope<T>;
  } catch (err) {
    return {
      envelope: null,
      exitCode,
      stderr,
      rawStdout: stdout,
    };
  }

  return {
    envelope,
    exitCode,
    stderr,
    rawStdout: stdout,
  };
}
