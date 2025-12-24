import { invoke } from './lib/tauri-bridge';

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
  command: string,
  args: string[] = []
): Promise<EndstateResult> {
  const fullArgs = [command, '--json', ...args];
  
  const result = await invoke<ExecResult>('endstate_exec', {
    args: fullArgs,
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
    command: parsed.command ?? command,
    schemaVersion: parsed.schemaVersion,
    cliVersion: parsed.cliVersion,
    rawStdout: result.stdout,
  };
}

export async function runCapabilities(): Promise<EndstateResult> {
  return runEndstateCommand('capabilities');
}

export async function runVerify(profile: string): Promise<EndstateResult> {
  return runEndstateCommand('verify', ['--profile', profile]);
}

export async function runApply(profile: string): Promise<EndstateResult> {
  return runEndstateCommand('apply', ['--profile', profile]);
}
