import { describe, it, expect, vi } from 'vitest';
import {
  fileToBase64,
  importProfileFromFile,
  importProfileFromPath,
} from './dropped-profile-import';

/**
 * jsdom's `File` in this environment does not implement `arrayBuffer()` / `text()`,
 * so build a minimal File-like stub that does. Only the fields the import
 * functions touch (`name`, `arrayBuffer`, `text`) are provided.
 */
function makeFile(bytes: number[] | string, name: string): File {
  const data =
    typeof bytes === 'string' ? new TextEncoder().encode(bytes) : new Uint8Array(bytes);
  return {
    name,
    arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    text: async () => new TextDecoder().decode(data),
  } as unknown as File;
}

/**
 * Runtime dispatch for profile imports (#187).
 *
 * The two import transports must stay cleanly separated by runtime:
 *  - Tauri desktop delivers a real file PATH (native drag-drop event / native
 *    browse dialog) → `importProfileFromPath` unzips from disk via
 *    `extract_zip_profile`, so bundle bytes NEVER cross IPC as a base64 blob.
 *  - Pure-browser / dev-bridge has only a File blob (no path) →
 *    `importProfileFromFile` base64-encodes as the reserved fallback.
 */
describe('importProfileFromPath (native path → no base64/IPC blob)', () => {
  it('routes a dropped .zip PATH to extract_zip_profile, never import_zip_from_base64', async () => {
    const invoke = vi.fn(async () => 'C:\\profiles\\manifest.jsonc');

    const result = await importProfileFromPath(
      'C:\\Users\\me\\Downloads\\big-capture.zip',
      'C:\\profiles',
      invoke,
    );

    expect(result).toBe('C:\\profiles\\manifest.jsonc');
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('extract_zip_profile', {
      zipPath: 'C:\\Users\\me\\Downloads\\big-capture.zip',
      profilesDir: 'C:\\profiles',
    });
    // The whole point of #187: the path route must not base64 over IPC.
    expect(invoke).not.toHaveBeenCalledWith(
      'import_zip_from_base64',
      expect.anything(),
    );
  });

  it('routes a dropped .endstate PATH to extract_zip_profile, exactly like a .zip', async () => {
    const invoke = vi.fn(async () => 'C:\profiles\manifest.jsonc');

    await importProfileFromPath(
      'C:\Users\me\Downloads\big-capture.endstate',
      'C:\profiles',
      invoke,
    );

    expect(invoke).toHaveBeenCalledWith('extract_zip_profile', {
      zipPath: 'C:\Users\me\Downloads\big-capture.endstate',
      profilesDir: 'C:\profiles',
    });
    expect(invoke).not.toHaveBeenCalledWith(
      'import_zip_from_base64',
      expect.anything(),
    );
  });

  it('matches the bundle extension case-insensitively', async () => {
    const invoke = vi.fn(async () => 'C:\profiles\manifest.jsonc');

    await importProfileFromPath('C:\Downloads\Capture.ENDSTATE', 'C:\profiles', invoke);

    expect(invoke).toHaveBeenCalledWith('extract_zip_profile', {
      zipPath: 'C:\Downloads\Capture.ENDSTATE',
      profilesDir: 'C:\profiles',
    });
  });

  it('routes a non-zip PATH to import_profile', async () => {
    const invoke = vi.fn(async () => 'C:\\profiles\\p.jsonc');

    await importProfileFromPath('/home/me/profile.jsonc', '/profiles', invoke);

    expect(invoke).toHaveBeenCalledWith('import_profile', {
      sourcePath: '/home/me/profile.jsonc',
      profilesDir: '/profiles',
    });
  });
});

describe('importProfileFromFile (browser/dev-bridge fallback → base64)', () => {
  it('routes a dropped .zip File to import_zip_from_base64 with base64 bytes', async () => {
    const invoke = vi.fn(
      async (_cmd: string, _args?: Record<string, unknown>) => 'C:\\profiles\\manifest.jsonc',
    );
    const file = makeFile([1, 2, 3, 4], 'capture.zip');

    const result = await importProfileFromFile(file, 'C:\\profiles', invoke);

    expect(result).toBe('C:\\profiles\\manifest.jsonc');
    expect(invoke).toHaveBeenCalledTimes(1);
    const [cmd, args] = invoke.mock.calls[0];
    expect(cmd).toBe('import_zip_from_base64');
    expect(args).toMatchObject({
      fileName: 'capture.zip',
      profilesDir: 'C:\\profiles',
    });
    expect((args as unknown as { data: string }).data).toBe(btoa('\x01\x02\x03\x04'));
    // Never touches the path-based command when only a blob is available.
    expect(invoke).not.toHaveBeenCalledWith(
      'extract_zip_profile',
      expect.anything(),
    );
  });

  it('routes a dropped .endstate File to import_zip_from_base64, exactly like a .zip', async () => {
    const invoke = vi.fn(
      async (_cmd: string, _args?: Record<string, unknown>) => 'C:\profiles\manifest.jsonc',
    );
    const file = makeFile([1, 2, 3, 4], 'capture.endstate');

    await importProfileFromFile(file, 'C:\profiles', invoke);

    const [cmd, args] = invoke.mock.calls[0];
    expect(cmd).toBe('import_zip_from_base64');
    expect(args).toMatchObject({
      fileName: 'capture.endstate',
      profilesDir: 'C:\profiles',
    });
    expect((args as unknown as { data: string }).data).toBe(btoa(''));
  });

  it('routes a manifest File to import_profile_text with its text content', async () => {
    const invoke = vi.fn(async () => 'C:\\profiles\\p.jsonc');
    const file = makeFile('{"name":"x"}', 'profile.jsonc');

    await importProfileFromFile(file, 'C:\\profiles', invoke);

    expect(invoke).toHaveBeenCalledWith('import_profile_text', {
      content: '{"name":"x"}',
      fileName: 'profile.jsonc',
      profilesDir: 'C:\\profiles',
    });
  });

  it('returns null and invokes nothing for an unsupported file type', async () => {
    const invoke = vi.fn(async () => '');
    const file = makeFile('x', 'notes.txt');

    const result = await importProfileFromFile(file, 'C:\\profiles', invoke);

    expect(result).toBeNull();
    expect(invoke).not.toHaveBeenCalled();
  });
});

describe('fileToBase64', () => {
  it('encodes raw bytes as base64', async () => {
    const file = makeFile([104, 105], 'x.zip');
    expect(await fileToBase64(file)).toBe(btoa('hi'));
  });
});
