import { describe, expect, it } from 'vitest';
import type { ApplyAction } from '@/types';
import {
  findSynthesizedManualAppIds,
  loadAuthoredProfileAppIds,
  parseAuthoredProfileAppIds,
} from './profile-app-provenance';

describe('profile app provenance', () => {
  it('reads authored app ids from JSONC without mistaking comments for data', () => {
    const content = `{
      // These are the apps the user actually put in the profile.
      "apps": [
        { "id": "vlc" },
        { "id": "manual-demo" }
      ]
    }`;

    expect(parseAuthoredProfileAppIds(content)).toEqual(new Set(['vlc', 'manual-demo']));
  });

  it('identifies only ref-less manual actions the engine added after loading the profile', () => {
    const actions: ApplyAction[] = [
      { id: 'vlc', ref: 'VideoLAN.VLC', status: 'present' },
      { id: 'manual-demo', ref: null, driver: 'manual', status: 'to_install' },
      { id: 'settings-only', ref: null, driver: 'manual', status: 'present' },
      { id: 'future-generated-winget', ref: 'Vendor.Future', status: 'to_install' },
    ];

    expect(
      findSynthesizedManualAppIds(actions, new Set(['vlc', 'manual-demo'])),
    ).toEqual(['settings-only']);
  });

  it('preserves the engine\'s case-sensitive app-id semantics', () => {
    const actions: ApplyAction[] = [
      { id: 'MANUAL-DEMO', ref: null, driver: 'manual', status: 'present' },
    ];

    expect(
      findSynthesizedManualAppIds(actions, new Set(['manual-demo'])),
    ).toEqual(['MANUAL-DEMO']);
  });

  it('loads authored app ids recursively from relative includes', async () => {
    const files = new Map([
      [
        'C:\\profiles\\root.jsonc',
        '{ "apps": [{ "id": "root-app" }], "includes": ["./nested/manuals.jsonc"] }',
      ],
      [
        'C:\\profiles\\nested\\manuals.jsonc',
        '{ "apps": [{ "id": "included-manual" }], "includes": ["../shared.jsonc"] }',
      ],
      [
        'C:\\profiles\\shared.jsonc',
        '{ "apps": [{ "id": "shared-app" }] }',
      ],
    ]);
    const readText = async (path: string) => {
      const content = files.get(path);
      if (!content) throw new Error(`unexpected path: ${path}`);
      return content;
    };

    await expect(
      loadAuthoredProfileAppIds('C:\\profiles\\root.jsonc', readText),
    ).resolves.toEqual(new Set(['root-app', 'included-manual', 'shared-app']));
  });
});
