import { ALL_NAMESPACES, clearAllKnownKeys, getItem, KNOWN_KEYS, setItem } from './lib/storage';
import { migrateProfileSelection } from './lib/profile-selection-migration';

export interface AppSettings {
  engineMode: 'bundled' | 'path';
  customProfilesDirectory: string;
  selectedProfileName: string | null;
  dryRunEnabled: boolean;
  showDetails: boolean;
  /** Opt-in for automatic hosted backup on capture. Reversible (Settings toggle). */
  autoBackupEnabled: boolean;
  /** Whether the one-time auto-backup consent prompt has been shown. */
  autoBackupPromptSeen: boolean;
  /**
   * ISO timestamp of the single post-capture Endstate Cloud invitation.
   *
   * Written BEFORE the invitation renders (record-before-present), so a crash
   * mid-presentation cannot turn a one-time invitation into a recurring prompt.
   * Null means it has never been presented. Same one-time shape as
   * `autoBackupPromptSeen`.
   */
  cloudInvitationShownAt: string | null;
  /**
   * Set once the user answers the invitation in any way — protect, keep it
   * local, or dismiss. Permanently suppresses automatic presentation; Endstate
   * Cloud stays reachable from the sidebar entry.
   */
  cloudInvitationDismissed: boolean;
  /** Durable evidence that the device has already used managed Endstate Cloud. */
  cloudInvitationManagedAccountSeen?: boolean;
  /** Persistent map: profile key → its hosted-backup id, so auto-push updates the same backup. */
  profileBackupIds: Record<string, string>;
  /** Opt-in for scheduled daily setup checks. */
  scheduleEnabled: boolean;
  /** Time-of-day (HH:MM, 24h) the scheduled drift check runs. */
  scheduleTime: string;
  /** Opt-in for auto-backup when the scheduled check finds changes (`--auto-push`). */
  scheduleAutoPush: boolean;
  /**
   * Absolute path of the last capture the user saved to file — the baseline
   * manifest the scheduled drift check verifies against. Null until a capture
   * has been saved ("Save this computer first").
   */
  scheduleManifestPath: string | null;
  /**
   * Marks that the one-time dry-run default correction has been applied.
   *
   * `dryRunEnabled` used to default to true, and `saveSettings` persists the
   * whole object — so every existing install has `dryRunEnabled: true` written
   * to storage whether or not the user ever chose it. Changing the default
   * alone would therefore fix only fresh installs and leave every existing user
   * unable to install anything, which is the defect this change exists to fix.
   *
   * Absent or false means the correction has not run yet.
   */
  dryRunDefaultCorrected?: boolean;
}

/** Legacy settings shape for one-time migration only */
interface LegacySettings {
  lastSelectedProfile?: string;
  lastSelectedProfilePath?: string;
}

const SETTINGS_KEY = 'endstate-gui-settings';
const CLOUD_INVITATION_CONSUMPTION_KEY = 'endstate-cloud-invitation-consumption';

export interface CloudInvitationConsumption {
  shownAt: string | null;
  dismissed: boolean;
  managedAccountSeen: boolean;
}

const DEFAULT_CLOUD_INVITATION_CONSUMPTION: CloudInvitationConsumption = {
  shownAt: null,
  dismissed: false,
  managedAccountSeen: false,
};

/** A denied or malformed consumption record must suppress the invitation. */
export function loadCloudInvitationConsumption(): CloudInvitationConsumption {
  try {
    const stored = getItem(CLOUD_INVITATION_CONSUMPTION_KEY);
    if (!stored) return DEFAULT_CLOUD_INVITATION_CONSUMPTION;
    const parsed = JSON.parse(stored) as Partial<CloudInvitationConsumption>;
    if (typeof parsed.dismissed !== 'boolean' || typeof parsed.managedAccountSeen !== 'boolean') {
      return { shownAt: 'unknown', dismissed: true, managedAccountSeen: true };
    }
    return {
      shownAt: typeof parsed.shownAt === 'string' ? parsed.shownAt : null,
      dismissed: parsed.dismissed,
      managedAccountSeen: parsed.managedAccountSeen,
    };
  } catch {
    return { shownAt: 'unknown', dismissed: true, managedAccountSeen: true };
  }
}

export function saveCloudInvitationConsumption(consumption: CloudInvitationConsumption): boolean {
  try {
    setItem(CLOUD_INVITATION_CONSUMPTION_KEY, JSON.stringify(consumption));
    return true;
  } catch (err) {
    console.error('Failed to save Endstate Cloud invitation consumption:', err);
    return false;
  }
}

const DEFAULT_SETTINGS: AppSettings = {
  engineMode: 'bundled',
  customProfilesDirectory: '',
  selectedProfileName: null,
  // False so the primary action actually provisions the machine. While this
  // defaulted to true, "Set up" appended --dry-run, installed nothing, and the
  // results screen still reported "Setup complete". Dry run remains an explicit
  // opt-in, and a run made under it is disclosed in the results (see
  // gui-integration-contract.md, "Dry-Run Disclosure"). Settings load preserves
  // an explicit user-set value — only this default changes.
  dryRunEnabled: false,
  showDetails: false,
  autoBackupEnabled: false,
  autoBackupPromptSeen: false,
  cloudInvitationShownAt: null,
  cloudInvitationDismissed: false,
  cloudInvitationManagedAccountSeen: false,
  profileBackupIds: {},
  scheduleEnabled: false,
  scheduleTime: '09:00',
  scheduleAutoPush: false,
  scheduleManifestPath: null,
  dryRunDefaultCorrected: true,
};

/**
 * One-time correction of the dry-run default on existing installs.
 *
 * `dryRunEnabled` defaulted to true and `saveSettings` writes the whole
 * settings object, so the value is persisted on every install regardless of
 * whether the user ever chose it. Changing the default alone would leave every
 * existing user running `--dry-run` — installing nothing while the results
 * screen reports "Setup complete".
 *
 * The stored value cannot distinguish "user deliberately chose dry run" from
 * "the old default was written to disk", and dry-run-by-default was a defect
 * rather than a plausible preference — nobody opts into never installing
 * anything. So the correction clears it once and records that it ran, leaving
 * the toggle free to be set again and never overriding a later choice.
 *
 * Mutates `parsed` in place; callers merge it over the defaults.
 */
function applyDryRunDefaultCorrection(parsed: Record<string, unknown>): void {
  if (parsed.dryRunDefaultCorrected === true) {
    return;
  }
  parsed.dryRunEnabled = false;
  parsed.dryRunDefaultCorrected = true;
}

export function loadSettings(): AppSettings {
  try {
    const stored = getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Migration: if stored settings have the removed 'script' mode, fall back to 'bundled'
      if (parsed.engineMode === 'script') {
        parsed.engineMode = 'bundled';
      }
      // Migration: strip removed engineScriptPath field
      delete parsed.engineScriptPath;
      applyDryRunDefaultCorrection(parsed);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
  return DEFAULT_SETTINGS;
}


export function saveSettings(settings: AppSettings): boolean {
  try {
    setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch (err) {
    console.error('Failed to save settings:', err);
    return false;
  }
}

/**
 * Replace ordinary preferences in the current settings namespace without
 * making a one-time invitation available again. Consumption is intentionally
 * not part of the ordinary reset lifecycle, and no other storage keys or
 * namespaces are reset here.
 */
export function resetAppSettings(): AppSettings {
  const current = loadSettings();
  const previousValues = new Map<string, string | null>();
  for (const key of KNOWN_KEYS) {
    previousValues.set(key, localStorage.getItem(key));
    for (const namespace of ALL_NAMESPACES) {
      const namespacedKey = `${namespace}:${key}`;
      previousValues.set(namespacedKey, localStorage.getItem(namespacedKey));
    }
  }
  const existingConsumption = loadCloudInvitationConsumption();
  const consumption: CloudInvitationConsumption = {
    shownAt: existingConsumption.shownAt ?? current.cloudInvitationShownAt,
    dismissed: existingConsumption.dismissed || current.cloudInvitationDismissed,
    managedAccountSeen: existingConsumption.managedAccountSeen || current.cloudInvitationManagedAccountSeen === true,
  };
  // Transactionally establish the non-preference record before clearing
  // ordinary settings. A failed write leaves every old setting untouched.
  if (!saveCloudInvitationConsumption(consumption)) return current;
  clearAllKnownKeys();
  const reset = { ...DEFAULT_SETTINGS };
  if (saveSettings(reset)) return reset;

  for (const [key, value] of previousValues) {
    try {
      if (value === null) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, value);
      }
    } catch {
      // A browser that keeps rejecting writes cannot be repaired here. The
      // successful consumption record remains durable and suppresses repeats.
    }
  }
  return current;
}

/**
 * Load settings with profile selection migration.
 * Migrates from legacy path-based selection to name-based selection.
 * Legacy keys are read once for migration but never re-persisted.
 * 
 * @param profilesDirectory - Current profiles directory for migration
 * @returns Settings with migrated profile selection
 */
export async function loadSettingsWithProfileMigration(
  profilesDirectory: string
): Promise<AppSettings> {
  // Load raw stored data to check for legacy fields
  const stored = getItem(SETTINGS_KEY);
  const parsed = stored ? JSON.parse(stored) : {};
  // Migration: if stored settings have the removed 'script' mode, fall back to 'bundled'
  if (parsed.engineMode === 'script') {
    parsed.engineMode = 'bundled';
  }
  // Migration: strip removed engineScriptPath field
  delete parsed.engineScriptPath;
  applyDryRunDefaultCorrection(parsed);
  const rawSettings: AppSettings & LegacySettings = { ...DEFAULT_SETTINGS, ...parsed };

  // If we already have selectedProfileName, return clean settings (no legacy fields)
  if (rawSettings.selectedProfileName) {
    // Return only the clean AppSettings fields
    const { lastSelectedProfile: _lsp, lastSelectedProfilePath: _lspp, ...cleanSettings } = rawSettings as AppSettings & LegacySettings;
    return cleanSettings as AppSettings;
  }

  // Check for legacy path-based selection
  if (rawSettings.lastSelectedProfilePath) {
    console.debug('[settings] Migrating legacy path-based profile selection');

    const migratedName = await migrateProfileSelection(
      rawSettings.lastSelectedProfilePath,
      profilesDirectory
    );

    if (migratedName) {
      const updatedSettings: AppSettings = {
        engineMode: rawSettings.engineMode,
        customProfilesDirectory: rawSettings.customProfilesDirectory,
        selectedProfileName: migratedName,
        dryRunEnabled: rawSettings.dryRunEnabled,
        dryRunDefaultCorrected: rawSettings.dryRunDefaultCorrected,
        showDetails: rawSettings.showDetails,
        autoBackupEnabled: rawSettings.autoBackupEnabled,
        autoBackupPromptSeen: rawSettings.autoBackupPromptSeen,
        cloudInvitationShownAt: rawSettings.cloudInvitationShownAt,
        cloudInvitationDismissed: rawSettings.cloudInvitationDismissed,
        cloudInvitationManagedAccountSeen: rawSettings.cloudInvitationManagedAccountSeen,
        profileBackupIds: rawSettings.profileBackupIds,
        scheduleEnabled: rawSettings.scheduleEnabled,
        scheduleTime: rawSettings.scheduleTime,
        scheduleAutoPush: rawSettings.scheduleAutoPush,
        scheduleManifestPath: rawSettings.scheduleManifestPath,
      };
      saveSettings(updatedSettings);
      console.debug('[settings] Profile selection migrated to name:', migratedName);
      return updatedSettings;
    } else {
      console.debug('[settings] Could not migrate legacy profile selection, clearing selection');
      const updatedSettings: AppSettings = {
        engineMode: rawSettings.engineMode,
        customProfilesDirectory: rawSettings.customProfilesDirectory,
        selectedProfileName: null,
        dryRunEnabled: rawSettings.dryRunEnabled,
        dryRunDefaultCorrected: rawSettings.dryRunDefaultCorrected,
        showDetails: rawSettings.showDetails,
        autoBackupEnabled: rawSettings.autoBackupEnabled,
        autoBackupPromptSeen: rawSettings.autoBackupPromptSeen,
        cloudInvitationShownAt: rawSettings.cloudInvitationShownAt,
        cloudInvitationDismissed: rawSettings.cloudInvitationDismissed,
        cloudInvitationManagedAccountSeen: rawSettings.cloudInvitationManagedAccountSeen,
        profileBackupIds: rawSettings.profileBackupIds,
        scheduleEnabled: rawSettings.scheduleEnabled,
        scheduleTime: rawSettings.scheduleTime,
        scheduleAutoPush: rawSettings.scheduleAutoPush,
        scheduleManifestPath: rawSettings.scheduleManifestPath,
      };
      saveSettings(updatedSettings);
      return updatedSettings;
    }
  }

  // Check for legacy lastSelectedProfile (name without path)
  if (rawSettings.lastSelectedProfile) {
    console.debug('[settings] Migrating legacy name-based profile selection');
    const updatedSettings: AppSettings = {
      engineMode: rawSettings.engineMode,
      customProfilesDirectory: rawSettings.customProfilesDirectory,
      selectedProfileName: rawSettings.lastSelectedProfile,
      dryRunEnabled: rawSettings.dryRunEnabled,
      dryRunDefaultCorrected: rawSettings.dryRunDefaultCorrected,
      showDetails: rawSettings.showDetails,
      autoBackupEnabled: rawSettings.autoBackupEnabled,
      autoBackupPromptSeen: rawSettings.autoBackupPromptSeen,
      cloudInvitationShownAt: rawSettings.cloudInvitationShownAt,
      cloudInvitationDismissed: rawSettings.cloudInvitationDismissed,
      cloudInvitationManagedAccountSeen: rawSettings.cloudInvitationManagedAccountSeen,
      profileBackupIds: rawSettings.profileBackupIds,
      scheduleEnabled: rawSettings.scheduleEnabled,
      scheduleTime: rawSettings.scheduleTime,
      scheduleAutoPush: rawSettings.scheduleAutoPush,
      scheduleManifestPath: rawSettings.scheduleManifestPath,
    };
    saveSettings(updatedSettings);
    return updatedSettings;
  }

  return rawSettings as AppSettings;
}

/**
 * Clear selected profile from settings.
 * Useful for "Reset Selected Profile" action.
 */
export function clearSelectedProfile(): void {
  const settings = loadSettings();
  const updated: AppSettings = {
    ...settings,
    selectedProfileName: null,
  };
  saveSettings(updated);
}
