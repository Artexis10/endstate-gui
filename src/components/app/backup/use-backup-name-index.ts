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

import { useCallback, useEffect, useRef, useState } from 'react';
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
  /** True only when the displayed list was resolved for the current account. */
  authoritative: boolean;
  refresh: () => Promise<void>;
}

const EMPTY: Map<string, BackupListItem> = new Map();

export function useBackupNameIndex(
  settings: AppSettings,
  enabled: boolean,
  accountKey: string | null,
): UseBackupNameIndexResult {
  const [index, setIndex] = useState<Map<string, BackupListItem>>(EMPTY);
  const [byId, setById] = useState<Map<string, BackupListItem>>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorAccountKey, setErrorAccountKey] = useState<string | null>(null);
  const [resolvedAccountKey, setResolvedAccountKey] = useState<string | null>(null);
  const generation = useRef(0);
  const current = useRef({ enabled, accountKey });
  current.current = { enabled, accountKey };

  const currentAccountIsEligible = enabled && accountKey !== null;

  const refresh = useCallback(async () => {
    const requestGeneration = ++generation.current;
    if (!enabled || accountKey === null) {
      setIndex(EMPTY);
      setById(EMPTY);
      setError(null);
      setErrorAccountKey(null);
      setResolvedAccountKey(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setErrorAccountKey(null);
    setResolvedAccountKey(null);
    try {
      const data = await backupList(settings);
      if (
        generation.current !== requestGeneration ||
        !current.current.enabled ||
        current.current.accountKey !== accountKey
      ) return;
      const nextByName = new Map<string, BackupListItem>();
      const nextById = new Map<string, BackupListItem>();
      for (const item of data.backups) {
        nextByName.set(item.name, item);
        nextById.set(item.id, item);
      }
      setIndex(nextByName);
      setById(nextById);
      setResolvedAccountKey(accountKey);
    } catch (err) {
      if (
        generation.current !== requestGeneration ||
        !current.current.enabled ||
        current.current.accountKey !== accountKey
      ) return;
      setIndex(EMPTY);
      setById(EMPTY);
      setError(err instanceof Error ? err.message : String(err));
      setErrorAccountKey(accountKey);
    } finally {
      if (
        generation.current === requestGeneration &&
        current.current.enabled &&
        current.current.accountKey === accountKey
      ) {
        setLoading(false);
      }
    }
  }, [accountKey, enabled, settings]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const authoritative =
    currentAccountIsEligible &&
    !loading &&
    error === null &&
    resolvedAccountKey === accountKey;

  return {
    index: authoritative ? index : EMPTY,
    byId: authoritative ? byId : EMPTY,
    loading: currentAccountIsEligible ? loading : false,
    error: currentAccountIsEligible && errorAccountKey === accountKey ? error : null,
    authoritative,
    refresh,
  };
}
