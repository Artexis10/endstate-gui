import { describe, it, expect } from 'vitest';
import { resolveCloudEntriesByKey, buildProfilePushArgs } from './cloud-hosting';
import type { BackupListItem } from '../types';
import type { AppSettings } from '../settings';

function item(id: string, name: string): BackupListItem {
  return { id, name, versionCount: 1, totalSize: 0, updatedAt: '2026-06-01T00:00:00Z' };
}

function byId(...items: BackupListItem[]): Map<string, BackupListItem> {
  return new Map(items.map((i) => [i.id, i]));
}

describe('resolveCloudEntriesByKey', () => {
  it('maps a profile key to its backup entry when the id is present in the list', () => {
    const result = resolveCloudEntriesByKey(
      { 'C:\\p\\work.jsonc': 'b1' },
      byId(item('b1', 'work')),
    );
    expect(result.get('C:\\p\\work.jsonc')?.id).toBe('b1');
  });

  it('omits a key whose mapped id is absent from the list (stale → Local only)', () => {
    const result = resolveCloudEntriesByKey(
      { 'C:\\p\\work.jsonc': 'deleted-id' },
      byId(item('b1', 'work')),
    );
    expect(result.has('C:\\p\\work.jsonc')).toBe(false);
  });

  it('isolates name collisions: two keys (same label, different ids) resolve independently', () => {
    // Two profiles share the label "gaming" but map to different backup ids.
    const result = resolveCloudEntriesByKey(
      { 'C:\\a\\gaming.jsonc': 'b-a', 'C:\\b\\gaming.jsonc': 'b-b' },
      byId(item('b-a', 'gaming')), // only b-a is hosted; b-b was deleted
    );
    expect(result.get('C:\\a\\gaming.jsonc')?.id).toBe('b-a');
    expect(result.has('C:\\b\\gaming.jsonc')).toBe(false);
  });

  it('returns an empty map for empty mappings', () => {
    expect(resolveCloudEntriesByKey({}, byId(item('b1', 'work'))).size).toBe(0);
  });

  it('tolerates an undefined mapping object', () => {
    expect(
      resolveCloudEntriesByKey(
        undefined as unknown as Record<string, string>,
        byId(item('b1', 'work')),
      ).size,
    ).toBe(0);
  });
});

describe('buildProfilePushArgs', () => {
  const settingsWith = (ids: Record<string, string>) =>
    ({ profileBackupIds: ids } as AppSettings);

  it('first host (no mapping) pushes with --name and no --backup-id', () => {
    const args = buildProfilePushArgs(
      settingsWith({}),
      'C:\\p\\work.jsonc',
      'work',
    );
    expect(args).toEqual({ profile: 'C:\\p\\work.jsonc', name: 'work' });
    expect(args.backupId).toBeUndefined();
  });

  it('re-host (mapping present) targets --backup-id and omits --name', () => {
    const args = buildProfilePushArgs(
      settingsWith({ 'C:\\p\\work.jsonc': 'b9' }),
      'C:\\p\\work.jsonc',
      'work',
    );
    expect(args).toEqual({ profile: 'C:\\p\\work.jsonc', backupId: 'b9' });
    expect(args.name).toBeUndefined();
  });
});
