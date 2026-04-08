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
  /** Profile summary from validation (optional) */
  summary?: ProfileSummary;
}

/**
 * Profile summary returned from validation.
 */
export interface ProfileSummary {
  name: string;
  version: number;
  appCount: number;
  captured?: string;
}

/**
 * Validation result from the engine.
 */
export interface ValidationResult {
  valid: boolean;
  errors: Array<{ code: string; message: string }>;
  summary?: ProfileSummary;
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
 * Validate a profile file against the Endstate profile contract.
 * Uses the engine validator via Tauri command.
 */
export async function validateProfile(path: string): Promise<ValidationResult> {
  try {
    const result = await invoke<ValidationResult>('validate_profile', { path });
    return result;
  } catch (err) {
    return {
      valid: false,
      errors: [{ code: 'VALIDATION_ERROR', message: String(err) }],
    };
  }
}

/**
 * Discover all profiles in a directory.
 * Returns ProfileDescriptor objects with merged metadata.
 * Excludes .meta.json files and invalid manifests from the list.
 * 
 * Profile validity is determined by the engine's profile contract:
 * - Must have version field (number, value 1)
 * - Must have apps field (array)
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
    const candidateFiles = files.filter(path => {
      if (!path || typeof path !== 'string') return false;
      const filename = path.split(/[/\\]/).pop() || '';
      return !isMetaFile(filename);
    });
    
    // Validate each candidate and only include valid profiles
    const profileResults = await Promise.all(
      candidateFiles.map(async (setupPath) => {
        const segments = setupPath.split(/[/\\]/);
        const filename = segments.pop() || '';
        const parentDir = segments.pop() || '';
        const bareFilename = filename.replace(/\.(jsonc?|json5)$/i, '');
        // For extracted zip bundles (e.g. Setups/my-desktop/manifest.jsonc),
        // use the parent directory name as the profile ID instead of "manifest"
        const dirBasename = directory.split(/[/\\]/).pop() || '';
        const isNestedInSubdir = parentDir !== '' && parentDir.toLowerCase() !== dirBasename.toLowerCase();
        const id = isNestedInSubdir ? parentDir : bareFilename;
        const metaPath = getMetaPath(setupPath);
        
        // Validate against profile contract
        const validation = await validateProfile(setupPath);
        if (!validation.valid) {
          // Skip invalid profiles (debug logging only)
          console.debug(`Skipping invalid profile: ${setupPath}`, validation.errors);
          return null;
        }
        
        // Load metadata for display name
        const metadata = await readProfileMetadata(setupPath);
        const displayName = metadata?.displayName;
        
        return {
          id,
          setupPath,
          metaPath,
          displayName,
          label: displayName || id,
          summary: validation.summary,
        };
      })
    );
    
    // Filter out null entries (invalid profiles)
    const validProfiles: ProfileDescriptor[] = [];
    for (const p of profileResults) {
      if (p !== null) {
        validProfiles.push(p);
      }
    }
    return validProfiles;
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
