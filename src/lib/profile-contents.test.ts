import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  appLabel,
  loadProfileContents,
  moduleIdFromRestoreSource,
  shortModuleId,
  summarizeProfileManifest,
} from './profile-contents';
import type { ProfileManifest } from './jsonc-parse';

vi.mock('./tauri-bridge', () => ({
  invoke: vi.fn(),
}));

describe('moduleIdFromRestoreSource', () => {
  it('derives the module id from the bundle-relative configs path', () => {
    expect(moduleIdFromRestoreSource('./configs/notepad-plus-plus/config.xml')).toBe(
      'notepad-plus-plus',
    );
    expect(moduleIdFromRestoreSource('configs\\vlc\\vlcrc')).toBe('vlc');
  });

  it('returns null when the source is not a module payload path', () => {
    expect(moduleIdFromRestoreSource(undefined)).toBeNull();
    expect(moduleIdFromRestoreSource('./somewhere-else/file.txt')).toBeNull();
    // A bare configs/<file> carries no module segment.
    expect(moduleIdFromRestoreSource('./configs/vlcrc')).toBeNull();
  });
});

describe('shortModuleId', () => {
  it('strips the apps namespace', () => {
    expect(shortModuleId('apps.vlc')).toBe('vlc');
    expect(shortModuleId('vlc')).toBe('vlc');
  });
});

describe('appLabel', () => {
  it('prefers the captured display name over the package ref', () => {
    expect(
      appLabel({ id: '7zip-7zip', displayName: '7-Zip 25.01 (x64)', refs: { windows: '7zip.7zip' } }),
    ).toBe('7-Zip 25.01 (x64)');
  });

  it('falls back to the package ref, then to the manifest id', () => {
    expect(appLabel({ id: 'vlc', refs: { windows: 'VideoLAN.VLC' } })).toBe('VideoLAN.VLC');
    expect(appLabel({ id: 'vlc' })).toBe('vlc');
  });
});

describe('summarizeProfileManifest', () => {
  it('counts and names apps and settings from a manifest v1 profile', () => {
    const manifest: ProfileManifest = {
      version: 1,
      name: 'golden-fixture',
      captured: '2026-07-18T12:00:00Z',
      apps: [
        { id: 'vlc', displayName: 'VLC media player', refs: { windows: 'VideoLAN.VLC' } },
        {
          id: 'notepad-plus-plus',
          displayName: 'Notepad++',
          refs: { windows: 'Notepad++.Notepad++' },
        },
      ],
      restore: [
        { type: 'copy', source: './configs/vlc/vlcrc', target: '%APPDATA%\\vlc\\vlcrc' },
        {
          type: 'copy',
          source: './configs/notepad-plus-plus/config.xml',
          target: '%APPDATA%\\Notepad++\\config.xml',
        },
        {
          type: 'copy',
          source: './configs/notepad-plus-plus/shortcuts.xml',
          target: '%APPDATA%\\Notepad++\\shortcuts.xml',
        },
      ],
    };

    const contents = summarizeProfileManifest(manifest);

    expect(contents.apps).toEqual(['VLC media player', 'Notepad++']);
    expect(contents.settingsModuleCount).toBe(2);
    expect(contents.settingsEntryCount).toBe(3);
    expect(contents.settings).toEqual([
      { label: 'VLC media player', entryCount: 1 },
      { label: 'Notepad++', entryCount: 2 },
    ]);
    expect(contents.captured).toBe('2026-07-18T12:00:00Z');
    expect(contents.manifestVersion).toBe(1);
  });

  it('reports no settings for an install-only profile', () => {
    const contents = summarizeProfileManifest({
      version: 1,
      name: 'apps-only',
      apps: [{ id: 'jq', refs: { windows: 'jqlang.jq' } }],
    });

    expect(contents.apps).toEqual(['jqlang.jq']);
    expect(contents.settings).toEqual([]);
    expect(contents.settingsModuleCount).toBe(0);
    expect(contents.settingsEntryCount).toBe(0);
    expect(contents.moduleIds).toEqual([]);
    expect(contents.captured).toBeNull();
  });

  it('counts manifest v2 config captures by their payload file count', () => {
    const contents = summarizeProfileManifest(
      {
        version: 2,
        name: 'capture-v2',
        apps: [],
        configCaptures: [
          {
            captureId: 'fixture-stable-preferences-installed',
            moduleId: 'apps.fixture-stable',
            configSetId: 'preferences',
            captureModule: { snapshotPath: 'provenance/modules/apps.fixture-stable.json' },
            payloadManifest: [{ relativePath: 'settings.json' }, { relativePath: 'keys.json' }],
          },
        ],
      },
      { 'apps.fixture-stable': 'Fixture Stable' },
    );

    expect(contents.settings).toEqual([{ label: 'Fixture Stable', entryCount: 2 }]);
    expect(contents.settingsModuleCount).toBe(1);
    expect(contents.settingsEntryCount).toBe(2);
  });

  it('ignores the flat restore list when config captures describe the same payload', () => {
    const contents = summarizeProfileManifest(
      {
        version: 2,
        apps: [],
        configCaptures: [
          {
            moduleId: 'apps.fixture-stable',
            payloadManifest: [{ relativePath: 'settings.json' }],
          },
        ],
        restore: [{ type: 'copy', source: './configs/fixture-stable/settings.json' }],
      },
      { 'apps.fixture-stable': 'Fixture Stable' },
    );

    expect(contents.settingsEntryCount).toBe(1);
    expect(contents.settingsModuleCount).toBe(1);
  });

  it('never uses a raw module id as a settings label', () => {
    const contents = summarizeProfileManifest({
      version: 1,
      // No app entry owns this module, so nothing friendly resolves.
      apps: [],
      restore: [{ type: 'copy', source: './configs/photoshop/prefs.psp' }],
    });

    expect(contents.settings).toEqual([]);
    // Still counted — the profile does carry it.
    expect(contents.settingsModuleCount).toBe(1);
    // And the id survives for the details disclosure.
    expect(contents.moduleIds).toEqual(['photoshop']);
  });

  it('rejects a snapshot display name that merely echoes the module id', () => {
    const contents = summarizeProfileManifest(
      {
        version: 2,
        apps: [],
        configCaptures: [
          { moduleId: 'apps.photoshop', payloadManifest: [{ relativePath: 'prefs.psp' }] },
        ],
      },
      { 'apps.photoshop': 'apps.photoshop' },
    );

    expect(contents.settings).toEqual([]);
    expect(contents.settingsModuleCount).toBe(1);
  });

  it('labels a settings module from the capture package ref when no name resolves', () => {
    const contents = summarizeProfileManifest({
      version: 2,
      apps: [],
      configCaptures: [
        {
          moduleId: 'apps.fixture-stable',
          sourceInstance: { evidence: { ref: 'Fixture.Stable' } },
          payloadManifest: [{ relativePath: 'settings.json' }],
        },
      ],
    });

    expect(contents.settings).toEqual([{ label: 'Fixture.Stable', entryCount: 1 }]);
  });

  it('tolerates a manifest with no apps or settings at all', () => {
    const contents = summarizeProfileManifest({});

    expect(contents.apps).toEqual([]);
    expect(contents.settings).toEqual([]);
    expect(contents.profileName).toBe('');
    expect(contents.manifestVersion).toBeNull();
  });
});

describe('loadProfileContents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses a JSONC manifest with comments', async () => {
    const { invoke } = await import('./tauri-bridge');
    vi.mocked(invoke).mockResolvedValue(`{
      // A captured profile.
      "version": 1,
      "name": "my-desktop",
      "apps": [{ "id": "vlc", "displayName": "VLC media player" }]
    }`);

    const contents = await loadProfileContents('C:\\Setups\\my-desktop\\manifest.jsonc');

    expect(contents.apps).toEqual(['VLC media player']);
    expect(contents.profileName).toBe('my-desktop');
  });

  it('reads module snapshots next to the manifest for real display names', async () => {
    const { invoke } = await import('./tauri-bridge');
    vi.mocked(invoke).mockImplementation(async (_cmd: string, args?: Record<string, unknown>) => {
      const path = args?.path as string;
      if (path.endsWith('manifest.jsonc')) {
        return JSON.stringify({
          version: 2,
          apps: [],
          configCaptures: [
            {
              moduleId: 'apps.fixture-stable',
              captureModule: { snapshotPath: 'provenance/modules/apps.fixture-stable.json' },
              payloadManifest: [{ relativePath: 'settings.json' }],
            },
          ],
        });
      }
      return JSON.stringify({ id: 'apps.fixture-stable', displayName: 'Fixture Stable' });
    });

    const contents = await loadProfileContents('C:\\Setups\\capture-v2\\manifest.jsonc');

    expect(contents.settings).toEqual([{ label: 'Fixture Stable', entryCount: 1 }]);
    expect(vi.mocked(invoke)).toHaveBeenCalledWith('read_text_file', {
      path: 'C:\\Setups\\capture-v2\\provenance\\modules\\apps.fixture-stable.json',
    });
  });

  it('summarizes the profile even when a module snapshot cannot be read', async () => {
    const { invoke } = await import('./tauri-bridge');
    vi.mocked(invoke).mockImplementation(async (_cmd: string, args?: Record<string, unknown>) => {
      const path = args?.path as string;
      if (path.endsWith('manifest.jsonc')) {
        return JSON.stringify({
          version: 2,
          apps: [{ id: 'fixture-stable', displayName: 'Fixture Stable' }],
          configCaptures: [
            {
              moduleId: 'apps.fixture-stable',
              captureModule: { snapshotPath: 'provenance/modules/apps.fixture-stable.json' },
              payloadManifest: [{ relativePath: 'settings.json' }],
            },
          ],
        });
      }
      throw new Error('File does not exist');
    });

    const contents = await loadProfileContents('C:\\Setups\\capture-v2\\manifest.jsonc');

    // Falls back to the owning app's display name rather than failing.
    expect(contents.settings).toEqual([{ label: 'Fixture Stable', entryCount: 1 }]);
  });

  it('does not read a snapshot path that escapes the provenance directory', async () => {
    const { invoke } = await import('./tauri-bridge');
    vi.mocked(invoke).mockResolvedValue(
      JSON.stringify({
        version: 2,
        apps: [],
        configCaptures: [
          {
            moduleId: 'apps.evil',
            captureModule: { snapshotPath: '../../../../etc/passwd' },
            payloadManifest: [],
          },
        ],
      }),
    );

    await loadProfileContents('C:\\Setups\\evil\\manifest.jsonc');

    expect(vi.mocked(invoke)).toHaveBeenCalledTimes(1);
  });

  it('propagates a manifest that cannot be parsed', async () => {
    const { invoke } = await import('./tauri-bridge');
    vi.mocked(invoke).mockResolvedValue('not json at all');

    await expect(loadProfileContents('C:\\Setups\\broken\\manifest.jsonc')).rejects.toThrow();
  });
});
