import { getItem, setItem } from './lib/storage';
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
  /** Persistent map: profile key → its hosted-backup id, so auto-push updates the same backup. */
  profileBackupIds: Record<string, string>;
  /** Opt-in for the scheduled daily drift check ("Continuous protection"). */
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
}

/** Legacy settings shape for one-time migration only */
interface LegacySettings {
  lastSelectedProfile?: string;
  lastSelectedProfilePath?: string;
}

const SETTINGS_KEY = 'endstate-gui-settings';

const DEFAULT_SETTINGS: AppSettings = {
  engineMode: 'bundled',
  customProfilesDirectory: '',
  selectedProfileName: null,
  dryRunEnabled: true,
  showDetails: false,
  autoBackupEnabled: false,
  autoBackupPromptSeen: false,
  profileBackupIds: {},
  scheduleEnabled: false,
  scheduleTime: '09:00',
  scheduleAutoPush: false,
  scheduleManifestPath: null,
};

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
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
  return DEFAULT_SETTINGS;
}


export function saveSettings(settings: AppSettings): void {
  try {
    setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save settings:', err);
  }
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
        showDetails: rawSettings.showDetails,
        autoBackupEnabled: rawSettings.autoBackupEnabled,
        autoBackupPromptSeen: rawSettings.autoBackupPromptSeen,
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
        showDetails: rawSettings.showDetails,
        autoBackupEnabled: rawSettings.autoBackupEnabled,
        autoBackupPromptSeen: rawSettings.autoBackupPromptSeen,
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
      showDetails: rawSettings.showDetails,
      autoBackupEnabled: rawSettings.autoBackupEnabled,
      autoBackupPromptSeen: rawSettings.autoBackupPromptSeen,
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
