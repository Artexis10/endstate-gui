/**
 * Engine Path Resolution - Robust path resolution for endstate engine script
 * 
 * Resolution order:
 * 1. Explicit user-configured engine path (if valid and exists)
 * 2. <repo>/bin/endstate.ps1
 * 3. <repo>/bin/endstate.cmd
 * 4. Fallback: 'endstate' from PATH (last resort)
 * 
 * Handles migration from old root-level endstate.ps1 to bin/endstate.ps1
 */

import { invoke, isTauriRuntime } from './tauri-bridge';

export interface EnginePathResult {
  /** Resolved path to use (null if should use PATH fallback) */
  path: string | null;
  /** Whether the path was migrated from old location */
  migrated: boolean;
  /** Original path before migration (if migrated) */
  originalPath?: string;
  /** Resolution method used */
  resolution: 'user_config' | 'bin_ps1' | 'bin_cmd' | 'path_fallback' | 'invalid';
  /** Debug message for logging */
  debugMessage: string;
}

/**
 * Check if a file exists on disk.
 * Returns false in web mode or on error.
 */
export async function fileExists(path: string): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  
  try {
    return await invoke<boolean>('check_file_exists', { path });
  } catch {
    return false;
  }
}

/**
 * Detect if a path points to the old root-level endstate.ps1 location
 * and return the migrated bin/ path if applicable.
 */
export function getMigratedPath(scriptPath: string): string | null {
  // Normalize path separators for comparison
  const normalized = scriptPath.replace(/\//g, '\\');
  
  // Check if path ends with \endstate.ps1 (root level, not in bin/)
  if (normalized.endsWith('\\endstate.ps1') && !normalized.endsWith('\\bin\\endstate.ps1')) {
    // Extract repo root and construct bin/ path
    const repoRoot = normalized.slice(0, -'\\endstate.ps1'.length);
    return `${repoRoot}\\bin\\endstate.ps1`;
  }
  
  return null;
}

/**
 * Get the repo root from a script path.
 * Handles both old (root/endstate.ps1) and new (root/bin/endstate.ps1) locations.
 */
export function getRepoRootFromScriptPath(scriptPath: string): string | null {
  const normalized = scriptPath.replace(/\//g, '\\');
  
  // New location: repo/bin/endstate.ps1 or repo/bin/endstate.cmd
  if (normalized.endsWith('\\bin\\endstate.ps1') || normalized.endsWith('\\bin\\endstate.cmd')) {
    return normalized.slice(0, normalized.lastIndexOf('\\bin\\'));
  }
  
  // Old location: repo/endstate.ps1
  if (normalized.endsWith('\\endstate.ps1')) {
    return normalized.slice(0, -'\\endstate.ps1'.length);
  }
  
  return null;
}

/**
 * Resolve the engine script path with validation and migration.
 * 
 * @param configuredPath - User-configured engine script path
 * @returns Resolved path result with validation status
 */
export async function resolveEnginePath(configuredPath: string): Promise<EnginePathResult> {
  // 1. Check if configured path exists
  if (configuredPath && await fileExists(configuredPath)) {
    return {
      path: configuredPath,
      migrated: false,
      resolution: 'user_config',
      debugMessage: `Using configured engine path: ${configuredPath}`,
    };
  }
  
  // 2. Check if configured path needs migration (old root location -> bin/)
  const migratedPath = getMigratedPath(configuredPath);
  if (migratedPath && await fileExists(migratedPath)) {
    return {
      path: migratedPath,
      migrated: true,
      originalPath: configuredPath,
      resolution: 'bin_ps1',
      debugMessage: `Migrated engine path from ${configuredPath} to ${migratedPath}`,
    };
  }
  
  // 3. Try to find bin/endstate.ps1 relative to configured path's repo root
  const repoRoot = getRepoRootFromScriptPath(configuredPath);
  if (repoRoot) {
    const binPs1Path = `${repoRoot}\\bin\\endstate.ps1`;
    if (await fileExists(binPs1Path)) {
      return {
        path: binPs1Path,
        migrated: configuredPath !== binPs1Path,
        originalPath: configuredPath !== binPs1Path ? configuredPath : undefined,
        resolution: 'bin_ps1',
        debugMessage: `Resolved to bin/endstate.ps1: ${binPs1Path}`,
      };
    }
    
    // 4. Try bin/endstate.cmd as fallback
    const binCmdPath = `${repoRoot}\\bin\\endstate.cmd`;
    if (await fileExists(binCmdPath)) {
      return {
        path: binCmdPath,
        migrated: true,
        originalPath: configuredPath,
        resolution: 'bin_cmd',
        debugMessage: `Resolved to bin/endstate.cmd: ${binCmdPath}`,
      };
    }
  }
  
  // 5. Configured path doesn't exist and can't be migrated
  // Return invalid result - caller should handle this
  return {
    path: null,
    migrated: false,
    resolution: 'invalid',
    debugMessage: `Engine script not found at configured path: ${configuredPath}. Tried: ${migratedPath || 'no migration available'}`,
  };
}

/**
 * Validate that an engine script path exists before execution.
 * Returns an error message if invalid, null if valid.
 */
export async function validateEngineScriptPath(scriptPath: string): Promise<string | null> {
  if (!scriptPath) {
    return 'Engine script path is not configured';
  }
  
  const exists = await fileExists(scriptPath);
  if (!exists) {
    // Provide helpful error message mentioning bin/ location
    const repoRoot = getRepoRootFromScriptPath(scriptPath);
    const binPath = repoRoot ? `${repoRoot}\\bin\\endstate.ps1` : null;
    
    if (binPath && scriptPath !== binPath) {
      return `Engine script not found at: ${scriptPath}\nThe engine may have moved to: ${binPath}`;
    }
    return `Engine script not found at: ${scriptPath}`;
  }
  
  return null;
}
