/**
 * Backup-pane state hook.
 *
 * Tracks the user's hosted-backup status, the list of backups, the versions
 * for the currently selected backup, and live progress state for push/pull.
 *
 * Per-feature local hook pattern (matches `useOverviewState` and friends —
 * no Zustand). See `openspec/changes/add-hosted-backup-gui/design.md`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  backupStatus,
  backupList,
  backupVersions,
  BackupCommandError,
} from '@/lib/backup-bridge';
import type {
  AppSettings,
} from '@/settings';
import type {
  BackupListItem,
  BackupStatusData,
  BackupVersionItem,
} from '@/types';
import { isBackupChunkEvent, isPhaseEvent } from '@/lib/streaming-events';
import type {
  BackupChunkEvent,
  StreamingEvent,
} from '@/lib/streaming-events';

export interface PushProgress {
  totalChunks: number;
  uploadedChunks: number;
  currentChunkIndex: number | null;
}

export interface PullProgress {
  totalChunks: number;
  downloadedChunks: number;
  verifiedChunks: number;
  decryptedChunks: number;
  /** The most recent sub-phase emitted by the engine. */
  subPhase: 'downloading' | 'verifying' | 'decrypting' | 'idle';
  currentChunkIndex: number | null;
}

const EMPTY_PUSH: PushProgress = {
  totalChunks: 0,
  uploadedChunks: 0,
  currentChunkIndex: null,
};

const EMPTY_PULL: PullProgress = {
  totalChunks: 0,
  downloadedChunks: 0,
  verifiedChunks: 0,
  decryptedChunks: 0,
  subPhase: 'idle',
  currentChunkIndex: null,
};

export interface UseBackupStateResult {
  loading: boolean;
  error: string | null;
  status: BackupStatusData | null;
  backups: BackupListItem[];
  versions: BackupVersionItem[];
  selectedBackupId: string | null;
  setSelectedBackupId: (id: string | null) => void;
  refresh: () => Promise<void>;
  refreshVersions: (backupId: string) => Promise<void>;
  // push state
  pushOpen: boolean;
  pushProgress: PushProgress;
  setPushOpen: (open: boolean) => void;
  resetPushProgress: () => void;
  // pull state
  pullOpen: boolean;
  pullProgress: PullProgress;
  setPullOpen: (open: boolean) => void;
  resetPullProgress: () => void;
  // streaming-event sinks (handed to backup-bridge)
  pushOnEvent: (event: StreamingEvent) => void;
  pullOnEvent: (event: StreamingEvent) => void;
}

export function useBackupState(settings: AppSettings): UseBackupStateResult {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<BackupStatusData | null>(null);
  const [backups, setBackups] = useState<BackupListItem[]>([]);
  const [versions, setVersions] = useState<BackupVersionItem[]>([]);
  const [selectedBackupId, setSelectedBackupId] = useState<string | null>(null);
  const [pushOpen, setPushOpen] = useState(false);
  const [pushProgress, setPushProgress] = useState<PushProgress>(EMPTY_PUSH);
  const [pullOpen, setPullOpen] = useState(false);
  const [pullProgress, setPullProgress] = useState<PullProgress>(EMPTY_PULL);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await backupStatus(settings);
      setStatus(s);
      if (s.signedIn) {
        const list = await backupList(settings);
        setBackups(list.backups);
        if (list.backups.length > 0 && !selectedBackupId) {
          setSelectedBackupId(list.backups[0].id);
        }
      } else {
        setBackups([]);
      }
    } catch (err) {
      if (err instanceof BackupCommandError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setLoading(false);
    }
  }, [settings, selectedBackupId]);

  const refreshVersions = useCallback(
    async (backupId: string) => {
      try {
        const data = await backupVersions(settings, backupId);
        setVersions(data.versions);
      } catch (err) {
        if (err instanceof BackupCommandError) {
          setError(err.message);
        } else {
          setError(err instanceof Error ? err.message : String(err));
        }
        setVersions([]);
      }
    },
    [settings],
  );

  // Auto-load versions when selectedBackupId changes (and we're signed in).
  const lastFetchedBackupRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedBackupId) {
      setVersions([]);
      return;
    }
    if (lastFetchedBackupRef.current === selectedBackupId) return;
    lastFetchedBackupRef.current = selectedBackupId;
    void refreshVersions(selectedBackupId);
  }, [selectedBackupId, refreshVersions]);

  // Initial load
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const resetPushProgress = useCallback(() => setPushProgress(EMPTY_PUSH), []);
  const resetPullProgress = useCallback(() => setPullProgress(EMPTY_PULL), []);

  /**
   * Apply a `backup-chunk` event to the push counters.
   *
   * `uploaded` is terminal-per-chunk so it advances `uploadedChunks`.
   * `uploading` updates the in-flight chunk index.
   */
  const pushOnEvent = useCallback((event: StreamingEvent) => {
    if (isPhaseEvent(event) && event.phase === 'backup-push') {
      // Phase event arrives once before the first chunk; reset counters.
      setPushProgress(EMPTY_PUSH);
      return;
    }
    if (!isBackupChunkEvent(event)) return;
    setPushProgress((prev) => applyPushChunk(prev, event));
  }, []);

  /**
   * Apply a `backup-chunk` event to the pull counters.
   *
   * Each chunk traverses `downloading` -> `verified` -> `decrypted`. The
   * dialog uses `decryptedChunks` for the overall percent but shows all
   * three counters.
   */
  const pullOnEvent = useCallback((event: StreamingEvent) => {
    if (isPhaseEvent(event) && event.phase === 'backup-pull') {
      setPullProgress(EMPTY_PULL);
      return;
    }
    if (!isBackupChunkEvent(event)) return;
    setPullProgress((prev) => applyPullChunk(prev, event));
  }, []);

  return {
    loading,
    error,
    status,
    backups,
    versions,
    selectedBackupId,
    setSelectedBackupId,
    refresh,
    refreshVersions,
    pushOpen,
    pushProgress,
    setPushOpen,
    resetPushProgress,
    pullOpen,
    pullProgress,
    setPullOpen,
    resetPullProgress,
    pushOnEvent,
    pullOnEvent,
  };
}

function applyPushChunk(prev: PushProgress, event: BackupChunkEvent): PushProgress {
  const totalChunks = event.totalChunks > 0 ? event.totalChunks : prev.totalChunks;
  if (event.status === 'uploading') {
    return {
      ...prev,
      totalChunks,
      currentChunkIndex: event.chunkIndex,
    };
  }
  if (event.status === 'uploaded') {
    return {
      ...prev,
      totalChunks,
      uploadedChunks: prev.uploadedChunks + 1,
      currentChunkIndex: null,
    };
  }
  // failed / unrelated — leave counters alone
  return { ...prev, totalChunks };
}

function applyPullChunk(prev: PullProgress, event: BackupChunkEvent): PullProgress {
  const totalChunks = event.totalChunks > 0 ? event.totalChunks : prev.totalChunks;
  switch (event.status) {
    case 'downloading':
      return {
        ...prev,
        totalChunks,
        subPhase: 'downloading',
        currentChunkIndex: event.chunkIndex,
      };
    case 'verified':
      return {
        ...prev,
        totalChunks,
        downloadedChunks: prev.downloadedChunks + 1,
        verifiedChunks: prev.verifiedChunks + 1,
        subPhase: 'verifying',
        currentChunkIndex: event.chunkIndex,
      };
    case 'decrypted':
      return {
        ...prev,
        totalChunks,
        decryptedChunks: prev.decryptedChunks + 1,
        subPhase: 'decrypting',
        currentChunkIndex: null,
      };
    default:
      return { ...prev, totalChunks };
  }
}
