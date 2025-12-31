/**
 * Run Artifacts - Persist run bundles for report trustworthiness
 * 
 * Each command run (capture, preview, apply, check/verify) creates a bundle:
 * - <profilesDirectory>/Runs/<runId>/
 *   - summary.json (validated with Zod)
 *   - diagnostics.txt
 *   - engine.log (stdout+stderr, truncated if huge)
 *   - events.jsonl (ndjson events if streaming enabled)
 */

import { z } from 'zod';
import { invoke, isTauriRuntime } from './tauri-bridge';

/** Maximum log size before truncation (100KB) */
const MAX_LOG_SIZE = 100 * 1024;

/** Zod schema for run summary */
export const RunSummarySchema = z.object({
  runId: z.string(),
  command: z.enum(['capture', 'apply', 'verify']),
  mode: z.enum(['capture', 'preview', 'apply', 'verify']),
  timestamp: z.string(),
  profileName: z.string().optional(),
  profilePath: z.string().optional(),
  outcome: z.enum(['success', 'partial', 'failed']),
  counts: z.object({
    captured: z.number().optional(),
    installed: z.number().optional(),
    alreadyPresent: z.number().optional(),
    skipped: z.number().optional(),
    failed: z.number().optional(),
    missing: z.number().optional(),
    present: z.number().optional(),
  }).optional(),
  durationMs: z.number().optional(),
});

export type RunSummary = z.infer<typeof RunSummarySchema>;

/** Run bundle paths */
export interface RunBundle {
  runId: string;
  directory: string;
  summaryPath: string;
  diagnosticsPath: string;
  logPath: string;
  eventsPath: string;
}

/** Generate a unique run ID */
export function generateRunId(): string {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${timestamp}_${suffix}`;
}

/** Get the Runs directory path */
export function getRunsDirectory(profilesDirectory: string): string {
  return `${profilesDirectory}\\Runs`;
}

/** Create a run bundle directory and return paths */
export async function createRunBundle(
  profilesDirectory: string,
  runId: string
): Promise<RunBundle | null> {
  if (!isTauriRuntime()) {
    console.debug('[run-artifacts] Skipping bundle creation in web mode');
    return null;
  }

  const runsDir = getRunsDirectory(profilesDirectory);
  const bundleDir = `${runsDir}\\${runId}`;

  try {
    await invoke('ensure_dir', { path: bundleDir });
    
    return {
      runId,
      directory: bundleDir,
      summaryPath: `${bundleDir}\\summary.json`,
      diagnosticsPath: `${bundleDir}\\diagnostics.txt`,
      logPath: `${bundleDir}\\engine.log`,
      eventsPath: `${bundleDir}\\events.jsonl`,
    };
  } catch (err) {
    console.error('[run-artifacts] Failed to create bundle directory:', err);
    return null;
  }
}

/** Write the summary.json file */
export async function writeSummary(
  bundle: RunBundle,
  summary: RunSummary
): Promise<boolean> {
  if (!isTauriRuntime()) return false;

  // Validate with Zod before writing
  const validation = RunSummarySchema.safeParse(summary);
  if (!validation.success) {
    console.error('[run-artifacts] Invalid summary:', validation.error);
    return false;
  }

  try {
    const content = JSON.stringify(validation.data, null, 2);
    await invoke('write_text_file', { path: bundle.summaryPath, content });
    return true;
  } catch (err) {
    console.error('[run-artifacts] Failed to write summary:', err);
    return false;
  }
}

/** Write the diagnostics.txt file */
export async function writeDiagnostics(
  bundle: RunBundle,
  diagnostics: string
): Promise<boolean> {
  if (!isTauriRuntime()) return false;

  try {
    await invoke('write_text_file', { path: bundle.diagnosticsPath, content: diagnostics });
    return true;
  } catch (err) {
    console.error('[run-artifacts] Failed to write diagnostics:', err);
    return false;
  }
}

/** Log buffer for accumulating engine output */
export class RunLogBuffer {
  private buffer: string[] = [];
  private totalSize = 0;
  private truncated = false;

  append(text: string): void {
    if (this.truncated) return;
    
    this.buffer.push(text);
    this.totalSize += text.length;
    
    if (this.totalSize > MAX_LOG_SIZE) {
      this.truncated = true;
    }
  }

  getContent(): string {
    let content = this.buffer.join('');
    if (this.truncated) {
      content = content.slice(0, MAX_LOG_SIZE) + '\n\n(truncated - log exceeded 100KB)';
    }
    return content;
  }

  isTruncated(): boolean {
    return this.truncated;
  }
}

/** Write the engine.log file */
export async function writeLog(
  bundle: RunBundle,
  logContent: string
): Promise<boolean> {
  if (!isTauriRuntime()) return false;

  try {
    // Truncate if too large
    let content = logContent;
    if (content.length > MAX_LOG_SIZE) {
      content = content.slice(0, MAX_LOG_SIZE) + '\n\n(truncated - log exceeded 100KB)';
    }
    await invoke('write_text_file', { path: bundle.logPath, content });
    return true;
  } catch (err) {
    console.error('[run-artifacts] Failed to write log:', err);
    return false;
  }
}

/** Append an event to events.jsonl */
export async function appendEvent(
  bundle: RunBundle,
  event: unknown
): Promise<boolean> {
  if (!isTauriRuntime()) return false;

  try {
    const line = JSON.stringify(event) + '\n';
    await invoke('append_text_file', { path: bundle.eventsPath, content: line });
    return true;
  } catch (err) {
    // append_text_file may not exist - fall back to silent failure
    console.debug('[run-artifacts] Failed to append event:', err);
    return false;
  }
}

/** Read a run summary from disk */
export async function readRunSummary(summaryPath: string): Promise<RunSummary | null> {
  if (!isTauriRuntime()) return null;

  try {
    const content = await invoke<string>('read_text_file', { path: summaryPath });
    const parsed = JSON.parse(content);
    const validation = RunSummarySchema.safeParse(parsed);
    
    if (validation.success) {
      return validation.data;
    }
    console.warn('[run-artifacts] Invalid summary file:', validation.error);
    return null;
  } catch (err) {
    console.debug('[run-artifacts] Failed to read summary:', err);
    return null;
  }
}

/** Check if a file exists */
export async function fileExists(path: string): Promise<boolean> {
  if (!isTauriRuntime()) return false;

  try {
    return await invoke<boolean>('check_file_exists', { path });
  } catch {
    return false;
  }
}

/** List all run bundles in the Runs directory */
export async function listRunBundles(profilesDirectory: string): Promise<RunBundle[]> {
  if (!isTauriRuntime()) return [];

  const runsDir = getRunsDirectory(profilesDirectory);
  
  try {
    const exists = await invoke<boolean>('check_file_exists', { path: runsDir });
    if (!exists) return [];

    const entries = await invoke<string[]>('read_dir', { path: runsDir });
    const bundles: RunBundle[] = [];

    for (const entry of entries) {
      // Each entry should be a runId directory
      const runId = entry.split(/[\\/]/).pop() || '';
      if (!runId) continue;

      const bundleDir = `${runsDir}\\${runId}`;
      const summaryPath = `${bundleDir}\\summary.json`;
      
      // Only include if summary.json exists
      const hasSummary = await invoke<boolean>('check_file_exists', { path: summaryPath });
      if (hasSummary) {
        bundles.push({
          runId,
          directory: bundleDir,
          summaryPath,
          diagnosticsPath: `${bundleDir}\\diagnostics.txt`,
          logPath: `${bundleDir}\\engine.log`,
          eventsPath: `${bundleDir}\\events.jsonl`,
        });
      }
    }

    return bundles;
  } catch (err) {
    console.error('[run-artifacts] Failed to list run bundles:', err);
    return [];
  }
}

/** Load run summaries from all bundles */
export async function loadRunSummaries(
  profilesDirectory: string
): Promise<Array<{ bundle: RunBundle; summary: RunSummary }>> {
  const bundles = await listRunBundles(profilesDirectory);
  const results: Array<{ bundle: RunBundle; summary: RunSummary }> = [];

  for (const bundle of bundles) {
    const summary = await readRunSummary(bundle.summaryPath);
    if (summary) {
      results.push({ bundle, summary });
    }
  }

  // Sort by timestamp descending (newest first)
  results.sort((a, b) => 
    new Date(b.summary.timestamp).getTime() - new Date(a.summary.timestamp).getTime()
  );

  return results;
}

/** Generate diagnostics text for a run */
export function generateDiagnosticsText(params: {
  command: string;
  mode: string;
  profileName?: string;
  profilePath?: string;
  outputPath?: string;
  counts?: Record<string, number>;
  apps?: string[];
}): string {
  const lines: string[] = [
    '=== Run Diagnostics ===',
    `Command: ${params.command}`,
    `Mode: ${params.mode}`,
    `Timestamp: ${new Date().toISOString()}`,
  ];

  if (params.profileName) {
    lines.push(`Profile: ${params.profileName}`);
  }
  if (params.profilePath) {
    lines.push(`Profile path: ${params.profilePath}`);
  }
  if (params.outputPath) {
    lines.push(`Output path: ${params.outputPath}`);
  }

  if (params.counts) {
    lines.push('', '--- Counts ---');
    for (const [key, value] of Object.entries(params.counts)) {
      if (value !== undefined) {
        lines.push(`${key}: ${value}`);
      }
    }
  }

  if (params.apps && params.apps.length > 0) {
    lines.push('', '--- Apps ---');
    for (const app of params.apps.slice(0, 100)) {
      lines.push(`  - ${app}`);
    }
    if (params.apps.length > 100) {
      lines.push(`  ... and ${params.apps.length - 100} more`);
    }
  }

  return lines.join('\n');
}
