import { invoke } from './tauri-bridge';

export interface ProfileMetadata {
  displayName?: string;
}

export async function saveProfileMetadata(profilePath: string, metadata: ProfileMetadata): Promise<void> {
  const metaPath = profilePath.replace(/\.(jsonc?|json5)$/i, '.meta.json');
  const content = JSON.stringify(metadata, null, 2);
  await invoke('write_text_file', { path: metaPath, content });
}
