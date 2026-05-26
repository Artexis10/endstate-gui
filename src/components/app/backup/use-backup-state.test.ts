/**
 * Push / pull progress reducers — pure logic for chunk-event accumulation.
 *
 * The backup-bridge wraps engine streaming events; the dialog reads counters
 * derived from those events. We pin the reducer logic here because it's
 * trivially testable and the dialog rendering depends on it.
 */

import { describe, expect, it, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useBackupState } from './use-backup-state';
import type { AppSettings } from '@/settings';
import type { StreamingEvent } from '@/lib/streaming-events';
import type { BackupStatusData } from '@/types';

vi.mock('@/lib/backup-bridge', () => {
  class BackupCommandError extends Error {
    code: string;
    remediation?: string;
    docsKey?: string;
    detail?: Record<string, unknown>;
    constructor(args: { code: string; message: string }) {
      super(args.message);
      this.code = args.code;
    }
  }
  return {
    backupStatus: vi.fn().mockResolvedValue({
      signedIn: false,
      issuerUrl: 'https://substratesystems.io',
    }),
    backupList: vi.fn().mockResolvedValue({ backups: [] }),
    backupVersions: vi.fn().mockResolvedValue({ backupId: 'b1', versions: [] }),
    BackupCommandError,
  };
});

import { backupList } from '@/lib/backup-bridge';
const mockBackupList = vi.mocked(backupList);

const SETTINGS: AppSettings = {
  engineMode: 'bundled',
  customProfilesDirectory: '',
  selectedProfileName: null,
  dryRunEnabled: false,
  showDetails: false,
};

const baseFields = {
  version: 1,
  runId: 'run-1',
  timestamp: '2026-05-10T00:00:00Z',
};

function chunk(
  status: 'uploading' | 'uploaded' | 'downloading' | 'verified' | 'decrypted',
  chunkIndex: number,
  totalChunks = 4,
): StreamingEvent {
  return {
    ...baseFields,
    event: 'backup-chunk',
    chunkIndex,
    totalChunks,
    encryptedSize: 1024,
    status,
  };
}

describe('useBackupState progress reducers', () => {
  it('accumulates push uploaded chunks and tracks current in-flight index', () => {
    const { result } = renderHook(() => useBackupState(SETTINGS));

    act(() => result.current.pushOnEvent(chunk('uploading', 0)));
    expect(result.current.pushProgress.totalChunks).toBe(4);
    expect(result.current.pushProgress.currentChunkIndex).toBe(0);
    expect(result.current.pushProgress.uploadedChunks).toBe(0);

    act(() => result.current.pushOnEvent(chunk('uploaded', 0)));
    expect(result.current.pushProgress.uploadedChunks).toBe(1);
    expect(result.current.pushProgress.currentChunkIndex).toBeNull();

    act(() => {
      result.current.pushOnEvent(chunk('uploading', 1));
      result.current.pushOnEvent(chunk('uploaded', 1));
    });
    expect(result.current.pushProgress.uploadedChunks).toBe(2);
  });

  it('tracks pull through downloading -> verified -> decrypted sub-phases', () => {
    const { result } = renderHook(() => useBackupState(SETTINGS));

    act(() => result.current.pullOnEvent(chunk('downloading', 0)));
    expect(result.current.pullProgress.subPhase).toBe('downloading');
    expect(result.current.pullProgress.currentChunkIndex).toBe(0);

    act(() => result.current.pullOnEvent(chunk('verified', 0)));
    expect(result.current.pullProgress.subPhase).toBe('verifying');
    expect(result.current.pullProgress.verifiedChunks).toBe(1);
    expect(result.current.pullProgress.downloadedChunks).toBe(1);

    act(() => result.current.pullOnEvent(chunk('decrypted', 0)));
    expect(result.current.pullProgress.subPhase).toBe('decrypting');
    expect(result.current.pullProgress.decryptedChunks).toBe(1);
    expect(result.current.pullProgress.currentChunkIndex).toBeNull();
  });

  it('skips backupList when initialStatus.subscriptionStatus is none', async () => {
    const initialStatus: BackupStatusData = {
      signedIn: true,
      email: 'user@example.com',
      userId: 'u-1',
      subscriptionStatus: 'none',
      issuerUrl: 'https://substratesystems.io',
    };
    mockBackupList.mockClear();

    const { result } = renderHook(() => useBackupState(SETTINGS, { initialStatus }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockBackupList).not.toHaveBeenCalled();
    expect(result.current.backups).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('seeds backups from initialBackups and renders without loading flash', async () => {
    const seeded = [
      {
        id: 'b-1',
        name: 'work',
        latestVersionId: 'v-1',
        versionCount: 3,
        totalSize: 1234,
        updatedAt: '2026-05-11T00:00:00Z',
      },
    ];
    const initialStatus: BackupStatusData = {
      signedIn: true,
      email: 'user@example.com',
      userId: 'u-1',
      subscriptionStatus: 'active',
      issuerUrl: 'https://substratesystems.io',
    };
    mockBackupList.mockResolvedValue({ backups: seeded });

    const { result } = renderHook(() =>
      useBackupState(SETTINGS, { initialStatus, initialBackups: seeded }),
    );

    // Cached state is visible synchronously — no spinner.
    expect(result.current.loading).toBe(false);
    expect(result.current.backups).toEqual(seeded);
    expect(result.current.selectedBackupId).toBe('b-1');
    // Background revalidation still fires.
    await waitFor(() => expect(mockBackupList).toHaveBeenCalledTimes(1));
    expect(result.current.loading).toBe(false);
  });

  it('treats SUBSCRIPTION_REQUIRED from backupList as a soft state', async () => {
    const { BackupCommandError } = await import('@/lib/backup-bridge');
    mockBackupList.mockRejectedValueOnce(
      new BackupCommandError({ code: 'SUBSCRIPTION_REQUIRED', message: 'no sub' }),
    );
    const initialStatus: BackupStatusData = {
      signedIn: true,
      email: 'user@example.com',
      userId: 'u-1',
      subscriptionStatus: 'cancelled',
      issuerUrl: 'https://substratesystems.io',
    };

    const { result } = renderHook(() => useBackupState(SETTINGS, { initialStatus }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.backups).toEqual([]);
  });

  it('phase event for backup-push resets push counters', () => {
    const { result } = renderHook(() => useBackupState(SETTINGS));
    act(() => {
      result.current.pushOnEvent(chunk('uploaded', 0));
      result.current.pushOnEvent(chunk('uploaded', 1));
    });
    expect(result.current.pushProgress.uploadedChunks).toBe(2);

    act(() =>
      result.current.pushOnEvent({
        ...baseFields,
        event: 'phase',
        phase: 'backup-push',
      }),
    );
    expect(result.current.pushProgress.uploadedChunks).toBe(0);
    expect(result.current.pushProgress.totalChunks).toBe(0);
  });
});

describe('useBackupState focus refresh', () => {
  it('refreshes when the window regains focus', async () => {
    vi.useFakeTimers();
    try {
      const { backupStatus } = await import('@/lib/backup-bridge');
      const mockBackupStatus = vi.mocked(backupStatus);
      mockBackupStatus.mockClear();
      mockBackupStatus.mockResolvedValue({
        signedIn: false,
        issuerUrl: 'https://substratesystems.io',
      });

      renderHook(() => useBackupState(SETTINGS));
      // Flush mount fetch
      await vi.advanceTimersByTimeAsync(0);
      const initialCalls = mockBackupStatus.mock.calls.length;

      window.dispatchEvent(new Event('focus'));
      // Debounced 1s
      await vi.advanceTimersByTimeAsync(1100);

      expect(mockBackupStatus.mock.calls.length).toBe(initialCalls + 1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('coalesces a focus burst within the debounce window into one refresh', async () => {
    vi.useFakeTimers();
    try {
      const { backupStatus } = await import('@/lib/backup-bridge');
      const mockBackupStatus = vi.mocked(backupStatus);
      mockBackupStatus.mockClear();
      mockBackupStatus.mockResolvedValue({
        signedIn: false,
        issuerUrl: 'https://substratesystems.io',
      });

      renderHook(() => useBackupState(SETTINGS));
      await vi.advanceTimersByTimeAsync(0);
      const initialCalls = mockBackupStatus.mock.calls.length;

      // Three focus events within the 1s debounce window must collapse into
      // a single refresh.
      window.dispatchEvent(new Event('focus'));
      await vi.advanceTimersByTimeAsync(100);
      window.dispatchEvent(new Event('focus'));
      await vi.advanceTimersByTimeAsync(100);
      window.dispatchEvent(new Event('focus'));
      await vi.advanceTimersByTimeAsync(1100);

      expect(mockBackupStatus.mock.calls.length).toBe(initialCalls + 1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('skips focus refresh while a push is in flight', async () => {
    vi.useFakeTimers();
    try {
      const { backupStatus } = await import('@/lib/backup-bridge');
      const mockBackupStatus = vi.mocked(backupStatus);
      mockBackupStatus.mockClear();
      mockBackupStatus.mockResolvedValue({
        signedIn: false,
        issuerUrl: 'https://substratesystems.io',
      });

      const { result } = renderHook(() => useBackupState(SETTINGS));
      await vi.advanceTimersByTimeAsync(0);
      const initialCalls = mockBackupStatus.mock.calls.length;

      act(() => result.current.setPushOpen(true));
      window.dispatchEvent(new Event('focus'));
      await vi.advanceTimersByTimeAsync(1100);

      expect(mockBackupStatus.mock.calls.length).toBe(initialCalls);
    } finally {
      vi.useRealTimers();
    }
  });
});
