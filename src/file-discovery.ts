import { invoke } from './lib/tauri-bridge';

/**
 * ProfileDescriptor: First-class profile object.
 * Represents a setup profile with optional metadata.
 * .meta.json files are implementation details and never appear as profiles.
 */
export interface ProfileDescriptor {
  /** Stable ID derived from basename (e.g., "setup_2024-01-15") */
  id: string;
  /** Path to the setup file (setup_*.json or setup_*.jsonc) */
  setupPath: string;
  /** Path to the metadata file (optional, may not exist) */
  metaPath: string;
  /** User-provided display name from metadata (optional) */
  displayName?: string;
  /** Computed label: displayName if present, else fallback to id */
  label: string;
}

/** @deprecated Use ProfileDescriptor instead */
export interface DiscoveredProfile {
  name: string;
  path: string;
  displayName?: string;
}

interface ProfileMetadata {
  displayName?: string;
}

/**
 * Check if a filename is a metadata file (*.meta.json)
 */
function isMetaFile(filename: string): boolean {
  return filename.toLowerCase().endsWith('.meta.json');
}

/**
 * Get the metadata path for a setup file
 */
export function getMetaPath(setupPath: string): string {
  return setupPath.replace(/\.(jsonc?|json5)$/i, '.meta.json');
}

/**
 * Read profile metadata from the .meta.json file
 */
async function readProfileMetadata(setupPath: string): Promise<ProfileMetadata | null> {
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
 * Discover all profiles in a directory.
 * Returns ProfileDescriptor objects with merged metadata.
 * Excludes .meta.json files from the list.
 */
export async function discoverProfileDescriptors(directory: string): Promise<ProfileDescriptor[]> {
  if (!directory || !directory.trim()) {
    return [];
  }

  try {
    const files = await invoke<string[]>('list_manifest_files', { directory });
    if (!files || !Array.isArray(files) || files.length === 0) {
      return [];
    }
    
    // Filter out .meta.json files - they are implementation details
    const setupFiles = files.filter(path => {
      if (!path || typeof path !== 'string') return false;
      const filename = path.split(/[/\\]/).pop() || '';
      return !isMetaFile(filename);
    });
    
    const profiles = await Promise.all(
      setupFiles.map(async (setupPath) => {
        const filename = setupPath.split(/[/\\]/).pop() || '';
        const id = filename.replace(/\.(jsonc?|json5)$/i, '');
        const metaPath = getMetaPath(setupPath);
        const metadata = await readProfileMetadata(setupPath);
        const displayName = metadata?.displayName;
        
        return {
          id,
          setupPath,
          metaPath,
          displayName,
          label: displayName || id,
        };
      })
    );
    
    return profiles;
  } catch (err) {
    console.error('Failed to discover profiles:', err);
    return [];
  }
}

/**
 * @deprecated Use discoverProfileDescriptors instead.
 * Legacy function for backward compatibility.
 */
export async function discoverProfiles(directory: string): Promise<DiscoveredProfile[]> {
  const descriptors = await discoverProfileDescriptors(directory);
  return descriptors.map(d => ({
    name: d.id,
    path: d.setupPath,
    displayName: d.displayName,
  }));
}
