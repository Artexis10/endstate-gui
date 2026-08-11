import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useBackupNameIndex } from './use-backup-name-index';
import type { AppSettings } from '@/settings';

vi.mock('@/lib/backup-bridge', () => ({
  backupList: vi.fn(),
}));

import { backupList } from '@/lib/backup-bridge';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

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
    const { result } = renderHook(() => useBackupNameIndex(SETTINGS, false, null));
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

    const { result } = renderHook(() => useBackupNameIndex(SETTINGS, true, 'account-a@example.com'));

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

    const { result } = renderHook(() => useBackupNameIndex(SETTINGS, true, 'account-a@example.com'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.byId.size).toBe(2);
    expect(result.current.byId.get('b1')?.name).toBe('work-laptop');
    expect(result.current.byId.get('b2')?.versionCount).toBe(1);
    // A backup id that is absent → undefined (drives the "Local only" fallback).
    expect(result.current.byId.get('does-not-exist')).toBeUndefined();
  });

  it('clears the byId map when disabled', async () => {
    const { result } = renderHook(() => useBackupNameIndex(SETTINGS, false, null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.byId.size).toBe(0);
  });

  it('returns an empty index and surfaces the error when the call fails', async () => {
    vi.mocked(backupList).mockRejectedValueOnce(new Error('AUTH_REQUIRED: not signed in'));

    const { result } = renderHook(() => useBackupNameIndex(SETTINGS, true, 'account-a@example.com'));

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

    const { result } = renderHook(() => useBackupNameIndex(SETTINGS, true, 'account-a@example.com'));
    await waitFor(() => expect(result.current.index.size).toBe(1));

    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.index.size).toBe(2);
    expect(result.current.index.has('second')).toBe(true);
  });

  it('does not restore an old account index when the current account is disabled', async () => {
    const pending = deferred<{ backups: Array<{ id: string; name: string; versionCount: number; totalSize: number; updatedAt: string }> }>();
    vi.mocked(backupList).mockReturnValueOnce(pending.promise);

    const { result, rerender } = renderHook(
      ({ enabled }) => useBackupNameIndex(SETTINGS, enabled, 'account-a@example.com'),
      { initialProps: { enabled: true } },
    );
    await waitFor(() => expect(backupList).toHaveBeenCalledTimes(1));

    rerender({ enabled: false });
    expect(result.current.index.size).toBe(0);
    expect(result.current.authoritative).toBe(false);

    await act(async () => {
      pending.resolve({
        backups: [{ id: 'a-1', name: 'account-a', versionCount: 1, totalSize: 1, updatedAt: '2026-08-10T00:00:00Z' }],
      });
      await pending.promise;
    });

    expect(result.current.index.size).toBe(0);
    expect(result.current.authoritative).toBe(false);
  });

  it('does not show account A results after switching to account B', async () => {
    const accountA = deferred<{ backups: Array<{ id: string; name: string; versionCount: number; totalSize: number; updatedAt: string }> }>();
    const accountB = deferred<{ backups: Array<{ id: string; name: string; versionCount: number; totalSize: number; updatedAt: string }> }>();
    vi.mocked(backupList)
      .mockReturnValueOnce(accountA.promise)
      .mockReturnValueOnce(accountB.promise);

    const { result, rerender } = renderHook(
      ({ account }) => useBackupNameIndex(SETTINGS, true, account),
      { initialProps: { account: 'account-a@example.com' } },
    );
    await waitFor(() => expect(backupList).toHaveBeenCalledTimes(1));

    rerender({ account: 'account-b@example.com' });
    await waitFor(() => expect(backupList).toHaveBeenCalledTimes(2));

    await act(async () => {
      accountA.resolve({
        backups: [{ id: 'a-1', name: 'account-a', versionCount: 1, totalSize: 1, updatedAt: '2026-08-10T00:00:00Z' }],
      });
      await accountA.promise;
    });
    expect(result.current.index.size).toBe(0);
    expect(result.current.authoritative).toBe(false);

    await act(async () => {
      accountB.resolve({
        backups: [{ id: 'b-1', name: 'account-b', versionCount: 1, totalSize: 1, updatedAt: '2026-08-10T00:00:00Z' }],
      });
      await accountB.promise;
    });
    expect(result.current.index.get('account-b')?.id).toBe('b-1');
    expect(result.current.authoritative).toBe(true);
  });
});
