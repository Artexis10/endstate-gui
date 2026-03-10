import { invoke } from './lib/tauri-bridge';
import { buildEngineCommand } from './lib/engine-exec';
import { AppSettings } from './settings';

interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface EndstateResult {
  success: boolean;
  data: unknown;
  error: {
    code: string;
    message: string;
  } | null;
  command: string;
  schemaVersion?: string;
  cliVersion?: string;
  rawStdout: string;
}

export async function runEndstateCommand(
  settings: AppSettings,
  command: string,
  args: string[] = []
): Promise<EndstateResult> {
  const fullArgs = [command, '--json', ...args];
  const engineCmd = await buildEngineCommand(settings, fullArgs);
  
  const result = await invoke<ExecResult>('endstate_exec', {
    exe: engineCmd.exe,
    args: engineCmd.args,
  });

  if (!result.stdout || !result.stdout.trim().startsWith('{')) {
    throw new Error(
      `Invalid endstate output: STDOUT must be pure JSON. Got: ${result.stdout.substring(0, 100)}`
    );
  }

  let parsed: any;
  try {
    parsed = JSON.parse(result.stdout);
  } catch (err) {
    throw new Error(`Failed to parse JSON from endstate STDOUT: ${err}`);
  }

  return {
    success: parsed.success ?? false,
    data: parsed.data ?? null,
    error: parsed.error ?? null,
    command: engineCmd.displayCommand,
    schemaVersion: parsed.schemaVersion,
    cliVersion: parsed.cliVersion,
    rawStdout: result.stdout,
  };
}

export async function runCapabilities(settings: AppSettings): Promise<EndstateResult> {
  return runEndstateCommand(settings, 'capabilities');
}

export async function runVerify(settings: AppSettings, profile: string): Promise<EndstateResult> {
  return runEndstateCommand(settings, 'verify', ['--profile', profile]);
}

export async function runApply(settings: AppSettings, profile: string): Promise<EndstateResult> {
  return runEndstateCommand(settings, 'apply', ['--profile', profile]);
}
