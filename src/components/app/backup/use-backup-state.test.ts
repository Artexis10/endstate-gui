/**
 * Push / pull progress reducers — pure logic for chunk-event accumulation.
 *
 * The backup-bridge wraps engine streaming events; the dialog reads counters
 * derived from those events. We pin the reducer logic here because it's
 * trivially testable and the dialog rendering depends on it.
 */

import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBackupState } from './use-backup-state';
import type { AppSettings } from '@/settings';
import type { StreamingEvent } from '@/lib/streaming-events';

vi.mock('@/lib/backup-bridge', () => ({
  backupStatus: vi.fn().mockResolvedValue({
    signedIn: false,
    issuerUrl: 'https://substratesystems.io',
  }),
  backupList: vi.fn().mockResolvedValue({ backups: [] }),
  backupVersions: vi.fn().mockResolvedValue({ backupId: 'b1', versions: [] }),
  BackupCommandError: class BackupCommandError extends Error {
    code = '';
    remediation?: string;
    docsKey?: string;
    detail?: Record<string, unknown>;
  },
}));

import { vi } from 'vitest';

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
