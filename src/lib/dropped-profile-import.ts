/**
 * Runtime-aware transport for profile imports (drop / browse in the Set up flow).
 *
 * There are two ways a profile file reaches the import handler, and they use
 * different backend commands so bundle bytes are handled efficiently:
 *
 *  - **Native file PATH** — the Tauri desktop runtime delivers real file paths
 *    (the native drag-drop event and the native browse dialog). These go to the
 *    path-based commands (`extract_zip_profile` / `import_profile`), which unzip
 *    directly from disk. A multi-MB bundle is NEVER base64-encoded and pushed
 *    across IPC (issue #187).
 *
 *  - **DOM File blob** — the pure-browser / dev-bridge runtime only has a `File`
 *    (a browser drop or the `<input type="file">` fallback), which carries no
 *    path. Zip bytes are base64-encoded and sent to `import_zip_from_base64`.
 *    This transport is reserved for that runtime; the dev-bridge body limit was
 *    raised in #186 so realistic bundles no longer 413.
 *
 * Keeping the dispatch here (instead of inline in `App.tsx`) makes the
 * runtime split explicit and unit-testable.
 *
 * Bundles arrive as `.endstate` or as the legacy `.zip`; both are the same zip
 * container, so both take the same transport. See `./profile-extensions`.
 */

import { isBundlePath, isManifestPath } from './profile-extensions';

/**
 * Minimal shape of the tauri-bridge `invoke` these helpers need. All profile
 * import commands resolve to the imported manifest path (a string). The real
 * generic `invoke<T>` is assignable to this.
 */
export type ImportInvoke = (
  cmd: string,
  args?: Record<string, unknown>,
) => Promise<string>;

/** Base64-encode a File's raw bytes (browser/dev-bridge transport only). */
export async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Import a profile that arrived as a native file PATH (Tauri drag-drop event or
 * native browse dialog). Uses the path-based engine commands so no base64 blob
 * crosses IPC. Returns the imported manifest path.
 */
export async function importProfileFromPath(
  path: string,
  profilesDir: string,
  invoke: ImportInvoke,
): Promise<string> {
  const fileName = path.split(/[/\\]/).pop() || '';
  if (isBundlePath(fileName)) {
    return invoke('extract_zip_profile', {
      zipPath: path,
      profilesDir,
    });
  }
  return invoke('import_profile', {
    sourcePath: path,
    profilesDir,
  });
}

/**
 * Import a profile that arrived as a DOM `File` blob (pure-browser / dev-bridge
 * runtime, where no native path exists). Zip bytes are base64-encoded — this
 * transport is the reserved fallback; the Tauri desktop path uses
 * {@link importProfileFromPath}. Returns the imported manifest path, or `null`
 * when the file type is unsupported.
 */
export async function importProfileFromFile(
  file: File,
  profilesDir: string,
  invoke: ImportInvoke,
): Promise<string | null> {
  if (isBundlePath(file.name)) {
    const data = await fileToBase64(file);
    return invoke('import_zip_from_base64', {
      data,
      fileName: file.name,
      profilesDir,
    });
  }
  if (isManifestPath(file.name)) {
    const content = await file.text();
    return invoke('import_profile_text', {
      content,
      fileName: file.name,
      profilesDir,
    });
  }
  return null;
}
