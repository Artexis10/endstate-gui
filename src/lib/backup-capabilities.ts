/**
 * Capability gating for automatic hosted backup.
 *
 * Auto-backup ships dark and only activates when the engine advertises
 * `backup push --if-changed` (content-hash dedup) AND the runtime conditions
 * hold. Every predicate here defaults to the safe/off answer when inputs are
 * missing, so the feature stays inert until the engine co-requisites land
 * (Artexis10/endstate#62 + #59).
 */

import type { EndstateCapabilitiesData, BackupStatusData } from '../types';

/**
 * Whether the engine advertises `backup push --if-changed`.
 *
 * Defaults to FALSE when unknown. Detection tolerates the engine's actual
 * capabilities envelope, where each command lists its flags under
 * `commands.<cmd>.flags` (the canonical signal that engine task 0.3 will extend
 * with `--if-changed`), plus a forward-compatible boolean fallback on the
 * hostedBackup capability.
 */
export function engineSupportsIfChanged(
  caps: EndstateCapabilitiesData | null | undefined,
): boolean {
  if (!caps) return false;

  // Canonical: '--if-changed' listed among the backup command's advertised flags.
  // The GUI's `commands` type is loose (string[]); the real engine emits a map,
  // so inspect defensively and only trust the map shape.
  const commands = (caps as { commands?: unknown }).commands;
  if (commands && typeof commands === 'object' && !Array.isArray(commands)) {
    const backup = (commands as Record<string, { flags?: unknown }>).backup;
    if (Array.isArray(backup?.flags) && backup!.flags.includes('--if-changed')) {
      return true;
    }
  }

  // Fallback: an explicit boolean on the hostedBackup capability.
  if (caps.features?.hostedBackup?.ifChanged === true) return true;

  return false;
}

/**
 * Whether the engine supports `backup rename` (mutable backup labels).
 *
 * Rename reuses `--backup-id`/`--name`, so there is no flag to probe — the only
 * signal is the explicit `features.hostedBackup.rename` boolean. Defaults to
 * FALSE when unknown, so the GUI's rename affordance stays hidden against an
 * older engine.
 */
export function engineSupportsRename(
  caps: EndstateCapabilitiesData | null | undefined,
): boolean {
  return caps?.features?.hostedBackup?.rename === true;
}

export interface AutoBackupConditions {
  hostedBackupSupported: boolean;
  ifChangedSupported: boolean;
  status: BackupStatusData | null | undefined;
}

/**
 * All conditions for auto-backup EXCEPT the user opt-in: hosted backup
 * supported, engine advertises `--if-changed`, signed in, and an active
 * subscription. Used to decide whether to show the one-time consent prompt.
 */
export function autoBackupAvailable(c: AutoBackupConditions): boolean {
  return (
    c.hostedBackupSupported &&
    c.ifChangedSupported &&
    c.status?.signedIn === true &&
    c.status?.subscriptionStatus === 'active'
  );
}

/**
 * Auto-backup is ACTIVE (a successful capture will trigger a background push)
 * when {@link autoBackupAvailable} AND the user has opted in.
 */
export function isAutoBackupActive(
  c: AutoBackupConditions & { autoBackupEnabled: boolean },
): boolean {
  return autoBackupAvailable(c) && c.autoBackupEnabled === true;
}
