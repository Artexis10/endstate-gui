import { invoke } from './lib/tauri-bridge';

export interface DiscoveredProfile {
  name: string;
  path: string;
  displayName?: string;
}

interface ProfileMetadata {
  displayName?: string;
}

async function readProfileMetadata(profilePath: string): Promise<ProfileMetadata | null> {
  try {
    const metaPath = profilePath.replace(/\.(jsonc?|json5)$/i, '.meta.json');
    const exists = await invoke<boolean>('check_file_exists', { path: metaPath });
    if (!exists) return null;
    
    const content = await invoke<string>('read_text_file', { path: metaPath });
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export async function discoverProfiles(directory: string): Promise<DiscoveredProfile[]> {
  if (!directory || !directory.trim()) {
    return [];
  }

  try {
    const files = await invoke<string[]>('list_manifest_files', { directory });
    if (!files || !Array.isArray(files) || files.length === 0) {
      return [];
    }
    
    const profiles = await Promise.all(
      files
        .filter(path => path && typeof path === 'string')
        .map(async (path) => {
          const filename = path.split(/[/\\]/).pop() || '';
          const name = filename.replace(/\.(jsonc?|json5)$/i, '');
          const metadata = await readProfileMetadata(path);
          return { 
            name, 
            path,
            displayName: metadata?.displayName
          };
        })
    );
    
    return profiles;
  } catch (err) {
    console.error('Failed to discover profiles:', err);
    return [];
  }
}
