import { invoke } from './lib/tauri-bridge';

export interface DiscoveredProfile {
  name: string;
  path: string;
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
    return files
      .filter(path => path && typeof path === 'string')
      .map((path) => {
        const filename = path.split(/[/\\]/).pop() || '';
        const name = filename.replace(/\.(jsonc?|json5)$/i, '');
        return { name, path };
      });
  } catch (err) {
    console.error('Failed to discover profiles:', err);
    return [];
  }
}
