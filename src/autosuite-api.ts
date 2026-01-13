import { invoke } from './lib/tauri-bridge';
import { EndstateEnvelope } from './types';
import { buildEngineCommand } from './lib/engine-exec';
import { AppSettings } from './settings';

interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface RunEndstateResult<T> {
  envelope: EndstateEnvelope<T> | null;
  exitCode: number;
  stderr: string;
  rawStdout: string;
}

export async function runEndstate<T>(
  settings: AppSettings,
  command: string,
  args: string[] = []
): Promise<RunEndstateResult<T>> {
  const fullArgs = [command, '--json', ...args];
  const engineCmd = buildEngineCommand(settings, fullArgs);

  let result: ExecResult;
  try {
    result = await invoke<ExecResult>('endstate_exec', {
      exe: engineCmd.exe,
      args: engineCmd.args,
    });
  } catch (err) {
    throw new Error(
      `Failed to execute endstate (${engineCmd.displayCommand}): ${err instanceof Error ? err.message : String(err)}`
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

  let envelope: EndstateEnvelope<T>;
  try {
    envelope = JSON.parse(stdout) as EndstateEnvelope<T>;
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
