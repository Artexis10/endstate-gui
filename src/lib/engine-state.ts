/**
 * Engine State - Read run history from engine log files on disk
 * 
 * This module provides disk-backed access to engine run logs,
 * making Reports fully auditable and deterministic.
 * 
 * Log file naming convention: <command>-<YYYYMMDD>-<HHMMSS>-<MACHINE>.log
 * Events file naming convention: <command>-<YYYYMMDD>-<HHMMSS>-<MACHINE>.events.jsonl
 */

import { invoke, isTauriRuntime } from './tauri-bridge';

/** Engine run derived from log files */
export interface EngineRun {
  /** Run ID derived from log filename (e.g., "capture-20251222-044732-MACHINE") */
  runId: string;
  /** Command type extracted from runId */
  command: 'apply' | 'verify' | 'capture' | 'plan' | 'restore' | 'unknown';
  /** Timestamp parsed from runId */
  timestamp: string;
  /** Whether this was a dry run (preview) - detected from runId prefix */
  dryRun: boolean;
  /** Absolute path to log file */
  logFile: string;
  /** Absolute path to events file (null if doesn't exist) */
  eventsFile: string | null;
  /** Whether log file exists (always true since we enumerate from logs) */
  logExists: boolean;
  /** Whether events file exists */
  eventsExists: boolean;
}

/**
 * Get engine root directory from a known path.
 * Assumes engine writes to logs/ and state/ relative to engine root.
 * Handles both old (root/endstate.ps1) and new (root/bin/endstate.ps1) locations.
 */
export function getEngineRoot(settings: { engineMode: 'path' | 'script' | 'bundled'; engineScriptPath?: string }): string | null {
  if (settings.engineMode === 'script' && settings.engineScriptPath) {
    const normalized = settings.engineScriptPath.replace(/\//g, '\\');
    
    // New location: repo/bin/endstate.ps1 or repo/bin/endstate.cmd
    if (normalized.endsWith('\\bin\\endstate.ps1') || normalized.endsWith('\\bin\\endstate.cmd')) {
      return normalized.slice(0, normalized.lastIndexOf('\\bin\\'));
    }
    
    // Old location: repo/endstate.ps1 - parent directory is engine root
    const parts = normalized.split(/[\\/]/);
    parts.pop(); // Remove endstate.ps1
    return parts.join('\\');
  }
  
  // For 'path' and 'bundled' modes, we can't determine engine root without running a command
  // Return null and let caller handle it
  return null;
}

/**
 * Parse a log filename to extract run information.
 * Log filename format: <command>-<YYYYMMDD>-<HHMMSS>-<MACHINE>.log
 * Example: capture-20251222-044732-WIN-LAPTOP.log
 */
function parseLogFilename(filename: string): { 
  runId: string; 
  command: EngineRun['command']; 
  timestamp: string;
  dryRun: boolean;
} | null {
  // Remove .log extension
  if (!filename.endsWith('.log')) return null;
  const runId = filename.slice(0, -4);
  
  // Parse command from prefix
  const commandMatch = runId.match(/^(apply-from-plan|apply|verify|capture|plan|restore)-/);
  if (!commandMatch) return null;
  
  let command: EngineRun['command'] = 'unknown';
  const commandStr = commandMatch[1];
  if (commandStr === 'apply' || commandStr === 'apply-from-plan') command = 'apply';
  else if (commandStr === 'verify') command = 'verify';
  else if (commandStr === 'capture') command = 'capture';
  else if (commandStr === 'plan') command = 'plan';
  else if (commandStr === 'restore') command = 'restore';
  
  // Parse timestamp: YYYYMMDD-HHMMSS
  const timestampMatch = runId.match(/(\d{8})-(\d{6})/);
  if (!timestampMatch) return null;
  
  const dateStr = timestampMatch[1]; // YYYYMMDD
  const timeStr = timestampMatch[2]; // HHMMSS
  
  // Convert to ISO timestamp
  const year = dateStr.slice(0, 4);
  const month = dateStr.slice(4, 6);
  const day = dateStr.slice(6, 8);
  const hour = timeStr.slice(0, 2);
  const minute = timeStr.slice(2, 4);
  const second = timeStr.slice(4, 6);
  const timestamp = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
  
  // Detect dry run from command prefix (apply-from-plan is never dry-run by itself)
  // Note: We can't reliably detect dry-run from filename alone
  const dryRun = false;
  
  return { runId, command, timestamp, dryRun };
}

/**
 * List all engine runs from log files on disk.
 * Returns newest first.
 */
export async function listEngineStates(engineRoot: string): Promise<EngineRun[]> {
  if (!isTauriRuntime()) return [];
  
  const logsDir = `${engineRoot}\\logs`;
  
  try {
    const exists = await invoke<boolean>('check_file_exists', { path: logsDir });
    if (!exists) return [];
    
    const entries = await invoke<string[]>('read_dir', { path: logsDir });
    const runs: EngineRun[] = [];
    
    for (const entry of entries) {
      // Only process .log files (not .events.jsonl)
      if (!entry.endsWith('.log')) continue;
      
      // Extract filename from full path
      const pathParts = entry.split(/[\\/]/);
      const filename = pathParts[pathParts.length - 1];
      
      const parsed = parseLogFilename(filename);
      if (!parsed) {
        console.debug('[engine-state] Could not parse log filename:', filename);
        continue;
      }
      
      const logFile = entry;
      const eventsFile = entry.replace(/\.log$/, '.events.jsonl');
      
      // Check if events file exists
      const eventsExists = await invoke<boolean>('check_file_exists', { path: eventsFile });
      
      runs.push({
        runId: parsed.runId,
        command: parsed.command,
        timestamp: parsed.timestamp,
        dryRun: parsed.dryRun,
        logFile,
        eventsFile: eventsExists ? eventsFile : null,
        logExists: true, // Always true since we enumerate from logs
        eventsExists,
      });
    }
    
    // Sort by timestamp descending (newest first)
    runs.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    return runs;
  } catch (err) {
    console.error('[engine-state] Failed to list engine runs:', err);
    return [];
  }
}

/**
 * Read file contents (for log/events viewing).
 */
export async function readFileContents(path: string): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  
  try {
    const content = await invoke<string>('read_text_file', { path });
    return content;
  } catch (err) {
    console.error('[engine-state] Failed to read file:', path, err);
    return null;
  }
}
