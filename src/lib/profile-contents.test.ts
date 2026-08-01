import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  appLabel,
  inspectProfileContents,
  loadProfileContents,
  moduleIdFromRestoreSource,
  ProfileInspectionError,
  shortModuleId,
  summarizeProfileManifest,
} from './profile-contents';
import type { ProfileManifest } from './jsonc-parse';
import type { AppSettings } from '../settings';

vi.mock('./tauri-bridge', () => ({
  invoke: vi.fn(),
}));

vi.mock('./engine-exec', () => ({
  runEndstateOnce: vi.fn(),
}));

const SETTINGS = {
  engineMode: 'bundled',
  customProfilesDirectory: '',
} as AppSettings;

function inspectionEnvelope() {
  return {
    schemaVersion: '1.0',
    cliVersion: '2.30.0',
    command: 'profile',
    runId: 'run-1',
    timestampUtc: '2026-08-01T12:00:00Z',
    success: true,
    data: {
      profile: {
        name: null,
        capturedAt: null,
        manifestVersion: 2,
        manifestPath: 'C:\\Profiles\\example\\manifest.jsonc',
      },
      summary: {
        appCount: 2,
        settingsRowCount: 4,
        verifiedSettingsAppCount: 2,
        unidentifiedSettingsRowCount: 2,
      },
      apps: [
        {
          id: 'app:one:1',
          manifestAppId: 'one',
          displayName: 'One',
          packageRefs: ['Example.One'],
          hasSettings: true,
        },
        {
          id: 'app:two:1',
          manifestAppId: 'two',
          displayName: 'Two',
          packageRefs: [],
          hasSettings: false,
        },
      ],
      settingsApps: [
        {
          id: 'settings:app:one:1',
          displayName: 'One settings',
          associationStatus: 'included',
          ownerId: 'app:one:1',
          appId: 'app:one:1',
          appIncluded: true,
          packageRefs: ['Example.One'],
          moduleIds: ['one'],
          candidateAppIds: ['app:one:1'],
          capturedEntryCount: 3,
        },
        {
          id: 'settings:absent',
          displayName: 'Absent settings',
          associationStatus: 'not_in_profile',
          ownerId: 'owner:absent',
          appId: null,
          appIncluded: false,
          packageRefs: ['Example.Absent'],
          moduleIds: ['absent'],
          candidateAppIds: [],
          capturedEntryCount: 0,
        },
        {
          id: 'settings:module:ambiguous',
          displayName: 'Ambiguous settings',
          associationStatus: 'ambiguous',
          ownerId: null,
          appId: null,
          appIncluded: false,
          packageRefs: ['Example.One', 'Example.Two'],
          moduleIds: ['ambiguous'],
          candidateAppIds: ['app:one:1', 'app:two:1'],
          capturedEntryCount: 1,
        },
        {
          id: 'settings:module:unresolved',
          displayName: 'Unresolved settings',
          associationStatus: 'unresolved',
          ownerId: null,
          appId: null,
          appIncluded: false,
          packageRefs: [],
          moduleIds: ['unresolved'],
          candidateAppIds: [],
          capturedEntryCount: 0,
        },
      ],
      warnings: [{ code: 'LEGACY', message: 'Legacy metadata', impact: 'diagnostic' }],
    },
    error: null,
  };
}

async function mockInspection(envelope = inspectionEnvelope()) {
  const { runEndstateOnce } = await import('./engine-exec');
  vi.mocked(runEndstateOnce).mockResolvedValue({
    success: true,
    envelope,
    stdout: JSON.stringify(envelope),
    stderr: '',
    exitCode: 0,
  } as never);
}

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

describe('inspectProfileContents', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await mockInspection();
  });

  it('uses the current settings and only profile inspect with the manifest path', async () => {
    const contents = await inspectProfileContents(SETTINGS, 'C:\\Profiles\\example\\manifest.jsonc');
    const { runEndstateOnce } = await import('./engine-exec');

    expect(runEndstateOnce).toHaveBeenCalledWith(SETTINGS, 'profile', [
      'inspect',
      'C:\\Profiles\\example\\manifest.jsonc',
    ]);
    expect(contents.apps.map((app) => app.displayName)).toEqual(['One', 'Two']);
  });

  it('preserves a valid engine result exactly, including explicit nulls and engine order', async () => {
    const envelope = inspectionEnvelope();
    (envelope.data as Record<string, unknown>).extra = { future: true };
    (envelope.data.apps[0] as Record<string, unknown>).extra = 'allowed';
    await mockInspection(envelope);

    await expect(inspectProfileContents(SETTINGS, 'C:\\Profiles\\example\\manifest.jsonc')).resolves.toEqual(
      envelope.data,
    );
  });

  it.each([
    ['non-1.x schema', (envelope: any) => { envelope.schemaVersion = '2.0'; }],
    ['incomplete schema version', (envelope: any) => { envelope.schemaVersion = '1.'; }],
    ['non-numeric schema minor', (envelope: any) => { envelope.schemaVersion = '1.bad'; }],
    ['schema version suffix', (envelope: any) => { envelope.schemaVersion = '1.0-junk'; }],
    ['wrong command', (envelope: any) => { envelope.command = 'inspect'; }],
    ['failed success flag', (envelope: any) => { envelope.success = false; }],
    ['non-null success error', (envelope: any) => { envelope.error = { code: 'BAD', message: 'bad' }; }],
    ['missing cli version', (envelope: any) => { delete envelope.cliVersion; }],
    ['empty cli version', (envelope: any) => { envelope.cliVersion = ''; }],
    ['missing run id', (envelope: any) => { delete envelope.runId; }],
    ['empty run id', (envelope: any) => { envelope.runId = ''; }],
    ['missing timestamp', (envelope: any) => { delete envelope.timestampUtc; }],
    ['empty timestamp', (envelope: any) => { envelope.timestampUtc = ''; }],
  ])('fails closed on a %s success envelope', async (_name, mutate) => {
    const envelope = inspectionEnvelope();
    mutate(envelope);
    await mockInspection(envelope);

    await expect(inspectProfileContents(SETTINGS, 'C:\\Profiles\\example\\manifest.jsonc')).rejects.toThrow(
      /incompatible profile inspection response/i,
    );
  });

  it.each([
    ['apps', (envelope: any) => { delete envelope.data.apps; }],
    ['settingsApps', (envelope: any) => { envelope.data.settingsApps = null; }],
    ['warnings', (envelope: any) => { delete envelope.data.warnings; }],
    ['app packageRefs', (envelope: any) => { envelope.data.apps[0].packageRefs = null; }],
    ['settings packageRefs', (envelope: any) => { delete envelope.data.settingsApps[0].packageRefs; }],
    ['settings moduleIds', (envelope: any) => { envelope.data.settingsApps[0].moduleIds = null; }],
    ['settings candidateAppIds', (envelope: any) => { delete envelope.data.settingsApps[0].candidateAppIds; }],
    ['profile name', (envelope: any) => { delete envelope.data.profile.name; }],
    ['profile capturedAt', (envelope: any) => { delete envelope.data.profile.capturedAt; }],
    ['row ownerId', (envelope: any) => { delete envelope.data.settingsApps[0].ownerId; }],
    ['row appId', (envelope: any) => { delete envelope.data.settingsApps[0].appId; }],
  ])('rejects a missing or null required %s field', async (_name, mutate) => {
    const envelope = inspectionEnvelope();
    mutate(envelope);
    await mockInspection(envelope);

    await expect(inspectProfileContents(SETTINGS, 'C:\\Profiles\\example\\manifest.jsonc')).rejects.toThrow(
      /incompatible profile inspection response/i,
    );
  });

  it.each([
    ['negative app count', (envelope: any) => { envelope.data.summary.appCount = -1; }],
    ['fractional app count', (envelope: any) => { envelope.data.summary.appCount = 1.5; }],
    ['negative captured entry count', (envelope: any) => { envelope.data.settingsApps[0].capturedEntryCount = -1; }],
    ['unknown association status', (envelope: any) => { envelope.data.settingsApps[0].associationStatus = 'maybe'; }],
    ['unknown warning impact', (envelope: any) => { envelope.data.warnings[0].impact = 'unknown'; }],
  ])('rejects an invalid %s', async (_name, mutate) => {
    const envelope = inspectionEnvelope();
    mutate(envelope);
    await mockInspection(envelope);

    await expect(inspectProfileContents(SETTINGS, 'C:\\Profiles\\example\\manifest.jsonc')).rejects.toThrow(
      /incompatible profile inspection response/i,
    );
  });

  it.each([
    ['included has a null owner', (row: any) => { row.ownerId = null; }],
    ['included has a different app id', (row: any) => { row.appId = 'app:two:1'; }],
    ['included is not marked included', (row: any) => { row.appIncluded = false; }],
    ['included has no sole candidate', (row: any) => { row.candidateAppIds = []; }],
    ['not in profile has an app id', (row: any) => { row.appId = 'app:one:1'; }],
    ['not in profile is marked included', (row: any) => { row.appIncluded = true; }],
    ['ambiguous has an owner', (row: any) => { row.ownerId = 'app:one:1'; }],
    ['ambiguous has no candidates', (row: any) => { row.candidateAppIds = []; }],
    ['ambiguous has only one candidate', (row: any) => { row.candidateAppIds = ['app:one:1']; }],
    ['ambiguous repeats a candidate', (row: any) => { row.candidateAppIds = ['app:one:1', 'app:one:1']; }],
    ['unresolved has candidates', (row: any) => { row.candidateAppIds = ['app:one:1']; }],
  ])('rejects when %s', async (_name, mutate) => {
    const envelope = inspectionEnvelope();
    const rows = envelope.data.settingsApps;
    const row = rows.find((candidate) => {
      if (_name.startsWith('included')) return candidate.associationStatus === 'included';
      if (_name.startsWith('not in profile')) return candidate.associationStatus === 'not_in_profile';
      if (_name.startsWith('ambiguous')) return candidate.associationStatus === 'ambiguous';
      return candidate.associationStatus === 'unresolved';
    });
    mutate(row);
    await mockInspection(envelope);

    await expect(inspectProfileContents(SETTINGS, 'C:\\Profiles\\example\\manifest.jsonc')).rejects.toThrow(
      /incompatible profile inspection response/i,
    );
  });

  it('rejects mismatched summary counts, invalid references, and hasSettings disagreement', async () => {
    const mismatch = inspectionEnvelope();
    mismatch.data.summary.appCount = 1;
    await mockInspection(mismatch);
    await expect(inspectProfileContents(SETTINGS, 'C:\\Profiles\\example\\manifest.jsonc')).rejects.toThrow(
      /incompatible profile inspection response/i,
    );

    const invalidReference = inspectionEnvelope();
    invalidReference.data.settingsApps[0].appId = 'app:missing:1';
    invalidReference.data.settingsApps[0].ownerId = 'app:missing:1';
    invalidReference.data.settingsApps[0].candidateAppIds = ['app:missing:1'];
    await mockInspection(invalidReference);
    await expect(inspectProfileContents(SETTINGS, 'C:\\Profiles\\example\\manifest.jsonc')).rejects.toThrow(
      /incompatible profile inspection response/i,
    );

    const hasSettingsMismatch = inspectionEnvelope();
    hasSettingsMismatch.data.apps[0].hasSettings = false;
    await mockInspection(hasSettingsMismatch);
    await expect(inspectProfileContents(SETTINGS, 'C:\\Profiles\\example\\manifest.jsonc')).rejects.toThrow(
      /incompatible profile inspection response/i,
    );
  });

  it('surfaces a structured engine failure with its code and message', async () => {
    const { runEndstateOnce } = await import('./engine-exec');
    vi.mocked(runEndstateOnce).mockResolvedValue({
      success: false,
      error: { kind: 'command_failed', message: 'Manifest was invalid' },
      envelope: {
        schemaVersion: '1.0',
        command: 'profile',
        success: false,
        data: null,
        error: { code: 'MANIFEST_VALIDATION_ERROR', message: 'Manifest was invalid' },
      },
    } as never);

    await expect(inspectProfileContents(SETTINGS, 'C:\\Profiles\\example\\manifest.jsonc')).rejects.toMatchObject(
      { name: 'ProfileInspectionError', code: 'MANIFEST_VALIDATION_ERROR', message: 'Manifest was invalid' },
    );
    await expect(inspectProfileContents(SETTINGS, 'C:\\Profiles\\example\\manifest.jsonc')).rejects.toBeInstanceOf(
      ProfileInspectionError,
    );
  });
});
