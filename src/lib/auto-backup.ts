/**
 * Background auto-backup orchestrator.
 *
 * A pure-ish async helper that performs a single silent `backup push
 * --if-changed` for a freshly-captured profile and classifies the result into
 * one of five outcomes. It does NOT touch React state, settings persistence, or
 * UI — the caller (App.tsx) maps the outcome to the inline chip, the paused
 * indicator, toasts, and the `profileBackupIds` persistence. Keeping it pure
 * makes the four-outcome mapping trivially testable.
 */

import { backupPush, BackupCommandError } from './backup-bridge';
import type { AppSettings } from '../settings';

export type AutoBackupOutcome =
  | { kind: 'uploaded'; backupId: string; versionId: string }
  | { kind: 'skipped'; backupId?: string }
  | { kind: 'auth-required' }
  | { kind: 'quota-exceeded' }
  | { kind: 'error' };

export interface RunAutoBackupArgs {
  settings: AppSettings;
  /** Absolute path to the just-captured profile to push (read before temp cleanup). */
  profilePath: string;
  /** Stable key identifying the profile, used to look up / store its backup id. */
  profileKey: string;
  /** Display name for a first-time auto-created backup (when no id is mapped yet). */
  name?: string;
}

/**
 * Run one silent auto-push. Never throws; failures are mapped to an outcome the
 * caller surfaces (or silently swallows, for transient errors).
 */
export async function runAutoBackup(
  args: RunAutoBackupArgs,
): Promise<AutoBackupOutcome> {
  const { settings, profilePath, profileKey, name } = args;
  const existingBackupId = settings.profileBackupIds?.[profileKey];

  try {
    const data = await backupPush(settings, {
      profile: profilePath,
      ifChanged: true,
      // First push for a profile omits --backup-id and passes --name; the engine
      // returns the new backup id, which the caller persists. Later pushes target it.
      backupId: existingBackupId,
      name: existingBackupId ? undefined : name ?? profileKey,
    });

    // Unchanged content → engine no-op. Success, zero UI noise. Carry backupId
    // so the caller can record the mapping if this was a first push.
    if (data.skipped || !data.versionId) {
      return { kind: 'skipped', backupId: data.backupId };
    }
    return { kind: 'uploaded', backupId: data.backupId, versionId: data.versionId };
  } catch (err) {
    if (err instanceof BackupCommandError) {
      if (err.code === 'AUTH_REQUIRED') return { kind: 'auth-required' };
      if (err.code === 'STORAGE_QUOTA_EXCEEDED') return { kind: 'quota-exceeded' };
    }
    // Transient / unreachable / unknown — silently skipped, retried next capture.
    return { kind: 'error' };
  }
}
