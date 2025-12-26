import { invoke } from './tauri-bridge';
import { getMetaPath } from '../file-discovery';

export interface ProfileMetadata {
  displayName?: string;
}

/**
 * Read profile metadata from the .meta.json file.
 * Returns null if the file doesn't exist or can't be read.
 */
export async function readProfileMetadata(setupPath: string): Promise<ProfileMetadata | null> {
  try {
    const metaPath = getMetaPath(setupPath);
    const exists = await invoke<boolean>('check_file_exists', { path: metaPath });
    if (!exists) return null;
    
    const content = await invoke<string>('read_text_file', { path: metaPath });
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Save profile metadata to the .meta.json file.
 * Creates the file if it doesn't exist, updates if it does.
 */
export async function saveProfileMetadata(setupPath: string, metadata: ProfileMetadata): Promise<void> {
  const metaPath = getMetaPath(setupPath);
  const content = JSON.stringify(metadata, null, 2);
  await invoke('write_text_file', { path: metaPath, content });
}

/**
 * Delete profile files (setup + metadata).
 * Deletes the setup file and its metadata file if present.
 */
export async function deleteProfileFiles(setupPath: string): Promise<void> {
  const metaPath = getMetaPath(setupPath);
  
  // Delete the setup file
  await invoke('delete_file', { path: setupPath });
  
  // Try to delete the metadata file (may not exist)
  try {
    const metaExists = await invoke<boolean>('check_file_exists', { path: metaPath });
    if (metaExists) {
      await invoke('delete_file', { path: metaPath });
    }
  } catch {
    // Metadata file may not exist, ignore errors
  }
}
