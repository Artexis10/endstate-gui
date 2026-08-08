import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useBackupNameIndex } from './use-backup-name-index';
import type { AppSettings } from '@/settings';

vi.mock('@/lib/backup-bridge', () => ({
  backupList: vi.fn(),
}));

import { backupList } from '@/lib/backup-bridge';

const SETTINGS: AppSettings = {
  engineMode: 'bundled',
  customProfilesDirectory: '',
  selectedProfileName: null,
  dryRunEnabled: false,
  showDetails: false,
  autoBackupEnabled: false,
  autoBackupPromptSeen: false,
  cloudInvitationShownAt: null,
  cloudInvitationDismissed: false,
  profileBackupIds: {},
  scheduleEnabled: false,
  scheduleTime: '09:00',
  scheduleAutoPush: false,
  scheduleManifestPath: null,
};

describe('useBackupNameIndex', () => {
  beforeEach(() => {
    vi.mocked(backupList).mockReset();
  });

  it('returns an empty index without firing the request when disabled', async () => {
    const { result } = renderHook(() => useBackupNameIndex(SETTINGS, false));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.index.size).toBe(0);
    expect(result.current.error).toBeNull();
    expect(backupList).not.toHaveBeenCalled();
  });

  it('indexes returned backups by name when enabled', async () => {
    vi.mocked(backupList).mockResolvedValueOnce({
      backups: [
        {
          id: 'b1',
          name: 'work-laptop',
          versionCount: 3,
          totalSize: 1024,
          updatedAt: '2026-05-10T20:00:00Z',
          latestVersionId: 'v3',
        },
        {
          id: 'b2',
          name: 'gaming-pc',
          versionCount: 1,
          totalSize: 512,
          updatedAt: '2026-05-09T20:00:00Z',
        },
      ],
    });

    const { result } = renderHook(() => useBackupNameIndex(SETTINGS, true));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.index.size).toBe(2);
    expect(result.current.index.get('work-laptop')?.versionCount).toBe(3);
    expect(result.current.index.get('gaming-pc')?.id).toBe('b2');
    expect(result.current.error).toBeNull();
  });

  it('also indexes returned backups by id', async () => {
    vi.mocked(backupList).mockResolvedValueOnce({
      backups: [
        {
          id: 'b1',
          name: 'work-laptop',
          versionCount: 3,
          totalSize: 1024,
          updatedAt: '2026-05-10T20:00:00Z',
          latestVersionId: 'v3',
        },
        {
          id: 'b2',
          name: 'gaming-pc',
          versionCount: 1,
          totalSize: 512,
          updatedAt: '2026-05-09T20:00:00Z',
        },
      ],
    });

    const { result } = renderHook(() => useBackupNameIndex(SETTINGS, true));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.byId.size).toBe(2);
    expect(result.current.byId.get('b1')?.name).toBe('work-laptop');
    expect(result.current.byId.get('b2')?.versionCount).toBe(1);
    // A backup id that is absent → undefined (drives the "Local only" fallback).
    expect(result.current.byId.get('does-not-exist')).toBeUndefined();
  });

  it('clears the byId map when disabled', async () => {
    const { result } = renderHook(() => useBackupNameIndex(SETTINGS, false));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.byId.size).toBe(0);
  });

  it('returns an empty index and surfaces the error when the call fails', async () => {
    vi.mocked(backupList).mockRejectedValueOnce(new Error('AUTH_REQUIRED: not signed in'));

    const { result } = renderHook(() => useBackupNameIndex(SETTINGS, true));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.index.size).toBe(0);
    expect(result.current.error).toContain('AUTH_REQUIRED');
  });

  it('re-fetches and rebuilds the index when refresh() is called', async () => {
    vi.mocked(backupList)
      .mockResolvedValueOnce({
        backups: [
          { id: 'b1', name: 'first', versionCount: 1, totalSize: 0, updatedAt: '2026-05-10T00:00:00Z' },
        ],
      })
      .mockResolvedValueOnce({
        backups: [
          { id: 'b1', name: 'first', versionCount: 1, totalSize: 0, updatedAt: '2026-05-10T00:00:00Z' },
          { id: 'b2', name: 'second', versionCount: 2, totalSize: 0, updatedAt: '2026-05-10T01:00:00Z' },
        ],
      });

    const { result } = renderHook(() => useBackupNameIndex(SETTINGS, true));
    await waitFor(() => expect(result.current.index.size).toBe(1));

    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.index.size).toBe(2);
    expect(result.current.index.has('second')).toBe(true);
  });
});
