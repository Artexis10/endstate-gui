/**
 * Profile selection migration utilities.
 * Migrates from legacy path-based selection to name-based selection.
 */

import { invoke } from './tauri-bridge';

export interface ProfileSelectionState {
  selectedProfileName: string | null;
}

/**
 * Migrate legacy path-based selection to name-based.
 * 
 * @param legacyPath - The legacy absolute path (e.g., "C:\Users\...\Setups\myprofile.jsonc")
 * @param profilesDirectory - The current profiles directory
 * @returns Migrated profile name if successful, null otherwise
 */
export async function migrateProfileSelection(
  legacyPath: string,
  profilesDirectory: string
): Promise<string | null> {
  if (!legacyPath || !profilesDirectory) {
    return null;
  }

  try {
    // First check if the legacy path still exists
    const pathExists = await invoke<boolean>('check_file_exists', { path: legacyPath });
    
    if (pathExists) {
      // Extract profile name from path (basename without extension)
      const filename = legacyPath.split(/[\\/]/).pop() || '';
      const profileName = filename.replace(/\.(jsonc?|json5)$/i, '');
      console.debug('[migration] Legacy path exists, extracted name:', profileName);
      return profileName;
    }

    // Path doesn't exist - try to extract name and resolve in profiles directory
    const filename = legacyPath.split(/[\\/]/).pop() || '';
    const profileName = filename.replace(/\.(jsonc?|json5)$/i, '');
    
    if (!profileName) {
      console.debug('[migration] Could not extract profile name from legacy path:', legacyPath);
      return null;
    }

    // Try to resolve in profiles directory with common extensions
    const extensions = ['.jsonc', '.json', '.json5'];
    for (const ext of extensions) {
      const resolvedPath = `${profilesDirectory}\\${profileName}${ext}`;
      const exists = await invoke<boolean>('check_file_exists', { path: resolvedPath });
      if (exists) {
        console.debug('[migration] Resolved profile by name in profiles directory:', profileName);
        return profileName;
      }
    }

    console.debug('[migration] Could not resolve profile by name:', profileName);
    return null;
  } catch (err) {
    console.error('[migration] Failed to migrate profile selection:', err);
    return null;
  }
}

/**
 * Resolve profile name to absolute path.
 * 
 * @param profileName - Profile name (without extension)
 * @param profilesDirectory - Profiles directory
 * @returns Absolute path if found, null otherwise
 */
export async function resolveProfilePath(
  profileName: string,
  profilesDirectory: string
): Promise<string | null> {
  if (!profileName || !profilesDirectory) {
    return null;
  }

  try {
    // Try common extensions in order of preference
    const extensions = ['.jsonc', '.json', '.json5'];
    for (const ext of extensions) {
      const path = `${profilesDirectory}\\${profileName}${ext}`;
      const exists = await invoke<boolean>('check_file_exists', { path });
      if (exists) {
        return path;
      }
    }
    return null;
  } catch (err) {
    console.error('[profile-selection] Failed to resolve profile path:', err);
    return null;
  }
}
