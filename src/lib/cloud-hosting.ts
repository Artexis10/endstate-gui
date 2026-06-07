/**
 * Unified per-profile hosted-backup helpers.
 *
 * Backups are addressed by their backend-assigned **id** (not by name). These
 * pure helpers translate between the local `profileBackupIds` (profileKey →
 * backupId) map and the real `backup list` state so the GUI can:
 *   - resolve each profile's cloud badge by id (truthful even on name
 *     collisions; falls back to "Local only" when the mapped id was deleted), and
 *   - decide whether a "Back up to cloud" push should version an existing
 *     backup (`--backup-id`) or create a new one (`--name`).
 *
 * Keeping them pure makes the id-based logic testable without mounting App.
 */

import type { BackupListItem } from '../types';
import type { AppSettings } from '../settings';
import { profileKeyFor } from './profile-key';

/**
 * Build a profileKey → BackupListItem map from the local id-mapping, verified
 * against the current `backup list` (keyed by id). A profile key is included
 * only when its mapped id is present in the list — so a deleted-in-cloud backup
 * correctly disappears (the row reverts to "Local only").
 */
export function resolveCloudEntriesByKey(
  profileBackupIds: Record<string, string>,
  byId: Map<string, BackupListItem>,
): Map<string, BackupListItem> {
  const out = new Map<string, BackupListItem>();
  if (!profileBackupIds) return out;
  for (const [key, id] of Object.entries(profileBackupIds)) {
    const entry = byId.get(id);
    if (entry) out.set(key, entry);
  }
  return out;
}

/**
 * Decide the `backupPush` arguments for hosting a profile from the Setup flow.
 * Re-host (a mapping exists AND the backup is still in the live list) → version
 * the same backup by id. Otherwise → create a backup labeled with the profile
 * name; the caller records the returned id under the profile key on success.
 *
 * The mapped id is verified against `byId` so a backup deleted here or on
 * another machine falls back to creating a fresh one instead of pushing to a
 * dead `--backup-id` (which the engine rejects). This mirrors the badge's
 * id-verification — the live list is the single source of truth.
 */
export function buildProfilePushArgs(
  settings: AppSettings,
  profilePath: string,
  profileName: string,
  byId: Map<string, BackupListItem>,
): { profile: string; backupId?: string; name?: string } {
  const key = profileKeyFor({ path: profilePath });
  const mappedId = settings.profileBackupIds?.[key];
  return mappedId && byId.has(mappedId)
    ? { profile: profilePath, backupId: mappedId }
    : { profile: profilePath, name: profileName };
}

/**
 * Remove every profile-key mapping that points at `deletedBackupId`. Called
 * when a backup is deleted so the local id-mapping doesn't retain a dead id
 * (which would otherwise make the next push target a deleted backup).
 */
export function pruneProfileBackupIds(
  profileBackupIds: Record<string, string>,
  deletedBackupId: string,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, id] of Object.entries(profileBackupIds ?? {})) {
    if (id !== deletedBackupId) out[key] = id;
  }
  return out;
}
