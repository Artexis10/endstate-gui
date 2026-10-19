import { invoke } from './lib/tauri-bridge';
import { backendErrorMessage } from './lib/import-errors';

/**
 * ProfileDescriptor: First-class profile object.
 * Represents a setup profile with optional metadata.
 * .meta.json files are implementation details and never appear as profiles.
 */
export interface ProfileDescriptor {
  /** Stable ID derived from basename (e.g., "setup_2024-01-15") */
  id: string;
  availability?: 'local' | 'online-only';
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
  availability?: 'local' | 'online-only';
  displayName?: string;
}

interface ProfileMetadata {
  displayName?: string;
}

/** A file in the profiles folder that is not a usable profile, with the validator's reason. */
export interface SkippedProfileFile {
  path: string;
  reason: string;
}

/**
 * Discovery result. A file left out of the list and a folder that could not be
 * read are reported here, never dropped, so the UI can say why a profile is
 * missing.
 */
export interface ProfileDescriptorDiscovery {
  descriptors: ProfileDescriptor[];
  skipped: SkippedProfileFile[];
  /** Why the folder could not be read; null when it was read. */
  error: string | null;
}

export interface ProfileDiscovery {
  profiles: DiscoveredProfile[];
  skipped: SkippedProfileFile[];
  error: string | null;
}

/**
 * Check if a filename is a metadata file (*.meta.json)
 */
function isMetaFile(filename: string): boolean {
  return filename.toLowerCase().endsWith('.meta.json');
}

/**
 * A capture bundle's root holds `manifest.jsonc` beside `metadata.json`
 * (engine docs/contracts/capture-artifact-contract.md, INV-CAPTURE-5), so the
 * metadata of an extracted bundle is bundle data, not a profile.
 */
function isBundleMetadata(path: string, listed: readonly string[]): boolean {
  if (fileNameOf(path).toLowerCase() !== 'metadata.json') return false;
  const folder = path.slice(0, path.length - fileNameOf(path).length);
  return listed.some((other) =>
    other.slice(0, other.length - fileNameOf(other).length) === folder
    && fileNameOf(other).toLowerCase() === 'manifest.jsonc');
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
      errors: [{ code: 'VALIDATION_ERROR', message: backendErrorMessage(err) }],
    };
  }
}

/**
 * Discover all profiles in a directory.
 * Returns ProfileDescriptor objects with merged metadata.
 * Excludes .meta.json files from the list, and reports each invalid manifest
 * in `skipped` with the validator's reason.
 *
 * Profile validity is determined by the engine's profile contract:
 * - Must have version field (number, supported values 1 or 2)
 * - Must have apps field (array)
 */
export async function discoverProfileDescriptors(directory: string): Promise<ProfileDescriptorDiscovery> {
  if (!directory || !directory.trim()) {
    return { descriptors: [], skipped: [], error: null };
  }

  try {
    const listed = await invoke<Array<string | { path: string; availability: 'local' | 'online-only'; metadataAvailable: boolean }>>('list_manifest_files', { directory, includeAvailability: true });
    const entries = (listed || []).map(entry => typeof entry === 'string' ? { path: entry, availability: 'local' as const, metadataAvailable: true } : entry);
    const byPath = new Map(entries.map(entry => [entry.path, entry]));
    const files = entries.map(entry => entry.path);
    if (!files || !Array.isArray(files) || files.length === 0) {
      return { descriptors: [], skipped: [], error: null };
    }

    // Filter out .meta.json files and bundle metadata - they are not profiles
    const candidateFiles = files.filter(path => {
      if (!path || typeof path !== 'string') return false;
      const filename = path.split(/[/\\]/).pop() || '';
      return !isMetaFile(filename) && !isBundleMetadata(path, files);
    });
    
    // Validate each candidate and only include valid profiles
    const profileResults = await Promise.all(
      candidateFiles.map(async (setupPath): Promise<{ descriptor: ProfileDescriptor } | { skipped: SkippedProfileFile }> => {
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
        
        const entry = byPath.get(setupPath);
        if (entry?.availability === 'online-only') {
          // Online-only placeholders are listed by name without opening them.
          return { descriptor: { id, setupPath, metaPath, label: filename, availability: 'online-only' } };
        }

        // Validate against profile contract
        const validation = await validateProfile(setupPath);
        if (!validation.valid) {
          const reason = validation.errors
            ?.map((error) => error.message)
            .filter(Boolean)
            .join('; ');
          return { skipped: { path: setupPath, reason: reason || 'Not a valid Endstate profile' } };
        }

        // Load metadata for display name
        const metadata = entry?.metadataAvailable ? await readProfileMetadata(setupPath) : null;
        const displayName = metadata?.displayName;
        
        const descriptor: ProfileDescriptor = {
          id,
          setupPath,
          metaPath,
          displayName,
          label: displayName || id,
          summary: validation.summary,
        };
        return { descriptor };
      })
    );

    const descriptors: ProfileDescriptor[] = [];
    const skipped: SkippedProfileFile[] = [];
    for (const result of profileResults) {
      if ('descriptor' in result) descriptors.push(result.descriptor);
      else skipped.push(result.skipped);
    }
    // Conflict copies and same-named setups in different folders stay apart.
    const counts = new Map<string, number>();
    for (const profile of descriptors) counts.set(profile.label, (counts.get(profile.label) || 0) + 1);
    for (const profile of descriptors) {
      if ((counts.get(profile.label) || 0) > 1) profile.label += ` (${profile.setupPath.slice(directory.length).replace(/^[\\/]+/, '')})`;
    }
    return { descriptors, skipped, error: null };
  } catch (err) {
    return { descriptors: [], skipped: [], error: backendErrorMessage(err) };
  }
}

/**
 * @deprecated Use discoverProfileDescriptors instead.
 * Legacy function for backward compatibility.
 */
export async function discoverProfiles(directory: string): Promise<ProfileDiscovery> {
  const { descriptors, skipped, error } = await discoverProfileDescriptors(directory);
  return {
    profiles: descriptors.map(d => ({
      name: d.id,
      path: d.setupPath,
      displayName: d.label !== d.id ? d.label : d.displayName,
      ...(d.availability ? { availability: d.availability } : {}),
    })),
    skipped,
    error,
  };
}

/** Basename of a profile path, for messages. */
function fileNameOf(path: string): string {
  return path.split(/[/\\]/).pop() || path;
}

/**
 * Default UX shows no file paths, so a backend reason that repeats a path the
 * GUI itself passed gets that exact value swapped for a generic name. This is
 * an exact-value replacement of a known string, not a reading of the reason.
 */
function withoutKnownPath(reason: string, path: string, name: string): string {
  return path ? reason.split(path).join(name) : reason;
}

/**
 * Plain-language notice for a profiles folder discovery could not read. Keeps
 * the backend reason (e.g. the folder does not exist) without its path.
 */
export function describeUnreadableProfilesFolder(directory: string, reason: string): string {
  return `Couldn't read your profiles folder: ${withoutKnownPath(reason, directory, 'the folder')}`;
}

/**
 * Plain-language notice for files discovery left out of the profile list.
 * Names the file and the validator's reason for one file; names the files for
 * several. Returns null when nothing was left out.
 */
export function describeSkippedProfiles(skipped: readonly SkippedProfileFile[]): string | null {
  if (skipped.length === 0) return null;
  if (skipped.length === 1) {
    const [only] = skipped;
    const name = fileNameOf(only.path);
    return `${name} in your profiles folder isn't a profile Endstate can use, so it isn't listed (${withoutKnownPath(only.reason, only.path, name)}).`;
  }
  const names = skipped.map((file) => fileNameOf(file.path)).join(', ');
  return `${skipped.length} files in your profiles folder aren't profiles Endstate can use, so they aren't listed: ${names}.`;
}
