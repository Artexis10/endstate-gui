/**
 * Index of remote backups by name, for cross-referencing local profile rows
 * against hosted-backup state.
 *
 * Used by the Manage Profiles modal to render a cloud indicator on profiles
 * that also have a corresponding hosted backup. Kept separate from
 * `useBackupState` (which owns the Backup pane's full data model) because
 * this consumer only needs a name → BackupListItem map and shouldn't pay
 * for the rest of that pane's state.
 *
 * Failures are swallowed: a transient network blip must not break Manage
 * Profiles. Callers can read `error` to surface a soft warning if they want
 * to, but the absence of cloud icons is the natural fallback.
 */

import { useCallback, useEffect, useState } from 'react';
import { backupList } from '@/lib/backup-bridge';
import type { BackupListItem } from '@/types';
import type { AppSettings } from '@/settings';

export interface UseBackupNameIndexResult {
  /** Backups keyed by name. Used by the "missing profile may have a cloud
   *  backup" restore hint, which only has the (deleted) profile's name. */
  index: Map<string, BackupListItem>;
  /** Backups keyed by backend id. The per-profile cloud badge resolves
   *  `profileBackupIds[key]` → id → entry against this map, so a deleted-in-
   *  cloud backup (id absent) correctly falls back to "Local only". */
  byId: Map<string, BackupListItem>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const EMPTY: Map<string, BackupListItem> = new Map();

export function useBackupNameIndex(
  settings: AppSettings,
  enabled: boolean,
): UseBackupNameIndexResult {
  const [index, setIndex] = useState<Map<string, BackupListItem>>(EMPTY);
  const [byId, setById] = useState<Map<string, BackupListItem>>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setIndex(EMPTY);
      setById(EMPTY);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await backupList(settings);
      const nextByName = new Map<string, BackupListItem>();
      const nextById = new Map<string, BackupListItem>();
      for (const item of data.backups) {
        nextByName.set(item.name, item);
        nextById.set(item.id, item);
      }
      setIndex(nextByName);
      setById(nextById);
    } catch (err) {
      setIndex(EMPTY);
      setById(EMPTY);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [enabled, settings]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { index, byId, loading, error, refresh };
}
