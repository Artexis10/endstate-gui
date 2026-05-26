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

/**
 * Structured fetch error surfaced from the hook to the pane. `message` is the
 * engine's user-facing copy; `remediation` is its curated next-step hint;
 * `code` lets the UI map specific failures (NETWORK_ERROR, TIMEOUT, …) to a
 * friendlier headline. All three may be undefined for non-BackupCommandError
 * failures (spawn errors, JSON parse errors).
 */
export interface BackupStateError {
  message: string;
  remediation?: string;
  code?: string;
}

export interface UseBackupStateResult {
  loading: boolean;
  error: BackupStateError | null;
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

export interface UseBackupStateOptions {
  /**
   * Called when a status fetch returns AUTH_REQUIRED, i.e. the engine's
   * session is gone (token revoked, refresh expired, keychain wiped).
   * The hook stops surfacing this as a hard error so the parent can route
   * the user back to the sign-in flow with a calm toast. If omitted, the
   * AUTH_REQUIRED is exposed via `error` like any other failure.
   */
  onAuthLost?: () => void;
  /**
   * Pre-fetched status from the parent (App.tsx already fetches it during
   * the auth flow). When set, the hook skips its own mount-time status
   * fetch and only loads the backup list — saving a redundant subprocess
   * spawn. Subsequent refresh() calls still hit the engine.
   */
  initialStatus?: BackupStatusData | null;
  /**
   * Pre-fetched backup list from the parent. App.tsx prefetches this in
   * parallel with auth so the Backup pane can render instantly on re-entry.
   * When set, the hook renders the cached list immediately (loading: false)
   * and silently revalidates in the background — stale-while-revalidate.
   * Engine subprocess spawns dominate latency (~300ms–2s on Windows); SWR
   * makes pane re-entry feel instant after the first session warm-up.
   */
  initialBackups?: BackupListItem[] | null;
}

export function useBackupState(
  settings: AppSettings,
  options: UseBackupStateOptions = {},
): UseBackupStateResult {
  // Seed loading from cache presence — if the parent has both status and
  // backups warm, mount with loading=false so the pane renders instantly.
  const hasSeedData =
    !!options.initialStatus && Array.isArray(options.initialBackups);
  const [loading, setLoading] = useState(!hasSeedData);
  const [error, setError] = useState<BackupStateError | null>(null);
  const [status, setStatus] = useState<BackupStatusData | null>(
    options.initialStatus ?? null,
  );
  const [backups, setBackups] = useState<BackupListItem[]>(
    options.initialBackups ?? [],
  );
  const [versions, setVersions] = useState<BackupVersionItem[]>([]);
  const [selectedBackupId, setSelectedBackupId] = useState<string | null>(
    options.initialBackups && options.initialBackups.length > 0
      ? options.initialBackups[0].id
      : null,
  );
  const [pushOpen, setPushOpen] = useState(false);
  const [pushProgress, setPushProgress] = useState<PushProgress>(EMPTY_PUSH);
  const [pullOpen, setPullOpen] = useState(false);
  const [pullProgress, setPullProgress] = useState<PullProgress>(EMPTY_PULL);

  // Pure error handling shared between full refresh() and the
  // backup-list-only path taken when initialStatus was provided.
  const handleFetchError = useCallback(
    (err: unknown) => {
      if (err instanceof BackupCommandError && err.code === 'AUTH_REQUIRED') {
        setStatus(null);
        setBackups([]);
        options.onAuthLost?.();
      } else if (err instanceof BackupCommandError) {
        setError({
          message: err.message,
          remediation: err.remediation,
          code: err.code,
        });
      } else {
        setError({
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [options],
  );

  const fetchBackupListFor = useCallback(
    async (currentStatus: BackupStatusData | null) => {
      if (!currentStatus?.signedIn) {
        setBackups([]);
        return;
      }
      // With no subscription on file the engine returns SUBSCRIPTION_REQUIRED
      // for `backup list` (read is blocked in the `none` state per contract §10).
      // Skip the call — the subscription banner already prompts the user to
      // subscribe and there is no list to show anyway.
      if (currentStatus.subscriptionStatus === 'none') {
        setBackups([]);
        return;
      }
      try {
        const list = await backupList(settings);
        setBackups(list.backups);
        if (list.backups.length > 0 && !selectedBackupId) {
          setSelectedBackupId(list.backups[0].id);
        }
      } catch (err) {
        // SUBSCRIPTION_REQUIRED is a soft state — surfacing it as a hard error
        // hides the subscription banner. Treat as empty list, no error.
        if (err instanceof BackupCommandError && err.code === 'SUBSCRIPTION_REQUIRED') {
          setBackups([]);
          return;
        }
        handleFetchError(err);
      }
    },
    [settings, selectedBackupId, handleFetchError],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await backupStatus(settings);
      setStatus(s);
      await fetchBackupListFor(s);
    } catch (err) {
      handleFetchError(err);
    } finally {
      setLoading(false);
    }
  }, [settings, fetchBackupListFor, handleFetchError]);

  const refreshVersions = useCallback(
    async (backupId: string) => {
      try {
        const data = await backupVersions(settings, backupId);
        setVersions(data.versions);
      } catch (err) {
        if (err instanceof BackupCommandError) {
          setError({
            message: err.message,
            remediation: err.remediation,
            code: err.code,
          });
        } else {
          setError({
            message: err instanceof Error ? err.message : String(err),
          });
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

  // Initial load — three paths:
  //   1. Both status and backups pre-fetched: render cached state instantly,
  //      revalidate the list in the background (SWR — no spinner).
  //   2. Only status pre-fetched: skip the status spawn, fetch only the list.
  //   3. Cold mount: do the full status+list fetch.
  const initialStatusOnMountRef = useRef(options.initialStatus ?? null);
  const initialBackupsOnMountRef = useRef(options.initialBackups ?? null);
  useEffect(() => {
    const seededStatus = initialStatusOnMountRef.current;
    const seededBackups = initialBackupsOnMountRef.current;
    if (seededStatus && seededBackups) {
      // SWR — already painted, revalidate silently. Don't flip `loading`,
      // don't clear `error` (cached data is already shown).
      void fetchBackupListFor(seededStatus);
    } else if (seededStatus) {
      setLoading(true);
      setError(null);
      fetchBackupListFor(seededStatus).finally(() => setLoading(false));
    } else {
      void refresh();
    }
    // Intentionally not depending on refresh/fetchBackupListFor — this
    // runs once on mount; later calls go through refresh() or refresh
    // triggered by selectedBackupId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-refresh on window focus or visibility change. Closes the "stale
  // session" loop — yesterday's signed-in user persists, but a focus-triggered
  // backup-status call returns AUTH_REQUIRED and routes through `onAuthLost`
  // to the sign-in surface. Coalesces focus + visibilitychange (Tauri fires
  // both) and skips while a push/pull is in flight so we don't disturb live
  // progress state.
  const inFlightRef = useRef({ pushOpen: false, pullOpen: false });
  useEffect(() => {
    inFlightRef.current.pushOpen = pushOpen;
  }, [pushOpen]);
  useEffect(() => {
    inFlightRef.current.pullOpen = pullOpen;
  }, [pullOpen]);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const trigger = () => {
      if (timeoutId !== null) return; // coalesce rapid focus+visibility pairs
      timeoutId = setTimeout(() => {
        timeoutId = null;
        if (inFlightRef.current.pushOpen || inFlightRef.current.pullOpen) return;
        void refresh();
      }, 1000);
    };
    const onFocus = () => trigger();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') trigger();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
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
