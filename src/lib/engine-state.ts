/**
 * Engine State - Read run history from engine state files on disk
 * 
 * This module provides disk-backed access to engine run state files,
 * making Reports fully auditable and deterministic.
 */

import { invoke, isTauriRuntime } from './tauri-bridge';
import { z } from 'zod';

/** Engine state file schema */
const EngineStateSchema = z.object({
  runId: z.string(),
  timestamp: z.string(),
  machine: z.string().optional(),
  user: z.string().optional(),
  command: z.enum(['apply', 'verify', 'capture']),
  dryRun: z.boolean().optional(),
  manifest: z.object({
    path: z.string().optional(),
    hash: z.string().optional(),
  }).optional(),
  summary: z.object({
    success: z.number().optional(),
    skipped: z.number().optional(),
    failed: z.number().optional(),
  }).optional(),
  actions: z.array(z.any()).optional(),
});

export type EngineState = z.infer<typeof EngineStateSchema>;

/** Engine run with file paths */
export interface EngineRun {
  state: EngineState;
  stateFile: string;
  logFile: string | null;
  eventsFile: string | null;
}

/**
 * Get engine root directory from a known path.
 * Assumes engine writes to logs/ and state/ relative to engine root.
 */
export function getEngineRoot(settings: { engineMode: 'path' | 'script' | 'bundled'; engineScriptPath?: string }): string | null {
  if (settings.engineMode === 'script' && settings.engineScriptPath) {
    // Script path points to endstate.ps1, engine root is parent directory
    const parts = settings.engineScriptPath.split(/[\\/]/);
    parts.pop(); // Remove endstate.ps1
    return parts.join('\\');
  }
  
  // For 'path' and 'bundled' modes, we can't determine engine root without running a command
  // Return null and let caller handle it
  return null;
}

/**
 * List all engine state files from disk.
 * Returns newest first.
 */
export async function listEngineStates(engineRoot: string): Promise<EngineRun[]> {
  if (!isTauriRuntime()) return [];
  
  const stateDir = `${engineRoot}\\state`;
  const logsDir = `${engineRoot}\\logs`;
  
  try {
    const exists = await invoke<boolean>('check_file_exists', { path: stateDir });
    if (!exists) return [];
    
    const entries = await invoke<string[]>('read_dir', { path: stateDir });
    const runs: EngineRun[] = [];
    
    for (const entry of entries) {
      // Only process .json files
      if (!entry.endsWith('.json')) continue;
      
      const stateFile = entry;
      
      try {
        const content = await invoke<string>('read_text_file', { path: stateFile });
        const parsed = JSON.parse(content);
        const validation = EngineStateSchema.safeParse(parsed);
        
        if (!validation.success) {
          console.debug('[engine-state] Invalid state file:', stateFile, validation.error);
          continue;
        }
        
        const state = validation.data;
        
        // Derive log and events file paths from runId
        const logFile = `${logsDir}\\${state.runId}.log`;
        const eventsFile = `${logsDir}\\${state.runId}.events.jsonl`;
        
        // Check if files exist
        const logExists = await invoke<boolean>('check_file_exists', { path: logFile });
        const eventsExists = await invoke<boolean>('check_file_exists', { path: eventsFile });
        
        runs.push({
          state,
          stateFile,
          logFile: logExists ? logFile : null,
          eventsFile: eventsExists ? eventsFile : null,
        });
      } catch (err) {
        console.debug('[engine-state] Failed to read state file:', stateFile, err);
        continue;
      }
    }
    
    // Sort by timestamp descending (newest first)
    runs.sort((a, b) => 
      new Date(b.state.timestamp).getTime() - new Date(a.state.timestamp).getTime()
    );
    
    return runs;
  } catch (err) {
    console.error('[engine-state] Failed to list engine states:', err);
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
