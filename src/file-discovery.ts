import { invoke } from '@tauri-apps/api/core';

export interface DiscoveredProfile {
  name: string;
  path: string;
}

export async function discoverProfiles(directory: string): Promise<DiscoveredProfile[]> {
  if (!directory.trim()) {
    return [];
  }

  try {
    const files = await invoke<string[]>('list_manifest_files', { directory });
    return files.map((path) => {
      const filename = path.split(/[/\\]/).pop() || '';
      const name = filename.replace(/\.(jsonc?|json5)$/i, '');
      return { name, path };
    });
  } catch (err) {
    console.error('Failed to discover profiles:', err);
    return [];
  }
}
