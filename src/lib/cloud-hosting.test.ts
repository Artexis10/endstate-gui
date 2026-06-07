import { describe, it, expect } from 'vitest';
import {
  resolveCloudEntriesByKey,
  buildProfilePushArgs,
  pruneProfileBackupIds,
} from './cloud-hosting';
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
      byId(item('b1', 'other')),
    );
    expect(args).toEqual({ profile: 'C:\\p\\work.jsonc', name: 'work' });
    expect(args.backupId).toBeUndefined();
  });

  it('re-host (mapping present AND backup still exists) targets --backup-id', () => {
    const args = buildProfilePushArgs(
      settingsWith({ 'C:\\p\\work.jsonc': 'b9' }),
      'C:\\p\\work.jsonc',
      'work',
      byId(item('b9', 'work')),
    );
    expect(args).toEqual({ profile: 'C:\\p\\work.jsonc', backupId: 'b9' });
    expect(args.name).toBeUndefined();
  });

  it('stale mapping (backup deleted) falls back to create, not a dead --backup-id', () => {
    // The backup was deleted (here or on another machine): the mapped id is no
    // longer in the live list. Pushing --backup-id <dead> would fail; instead we
    // create a fresh backup. Mirrors the badge's id-verification.
    const args = buildProfilePushArgs(
      settingsWith({ 'C:\\p\\work.jsonc': 'deleted-id' }),
      'C:\\p\\work.jsonc',
      'work',
      byId(item('b1', 'something-else')),
    );
    expect(args).toEqual({ profile: 'C:\\p\\work.jsonc', name: 'work' });
    expect(args.backupId).toBeUndefined();
  });
});

describe('pruneProfileBackupIds', () => {
  it('removes every key mapping to the deleted backup id', () => {
    const result = pruneProfileBackupIds(
      { 'C:\\a.jsonc': 'b1', 'C:\\b.jsonc': 'b2' },
      'b1',
    );
    expect(result).toEqual({ 'C:\\b.jsonc': 'b2' });
  });

  it('removes all keys sharing the deleted id (auto + manual of the same profile)', () => {
    const result = pruneProfileBackupIds(
      { 'auto:x': 'b1', 'C:\\x.jsonc': 'b1', 'C:\\y.jsonc': 'b2' },
      'b1',
    );
    expect(result).toEqual({ 'C:\\y.jsonc': 'b2' });
  });

  it('is a no-op when no key maps to the id', () => {
    const map = { 'C:\\a.jsonc': 'b1' };
    expect(pruneProfileBackupIds(map, 'nope')).toEqual(map);
  });

  it('tolerates an undefined mapping', () => {
    expect(
      pruneProfileBackupIds(undefined as unknown as Record<string, string>, 'b1'),
    ).toEqual({});
  });
});
