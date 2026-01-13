import { getItem, setItem } from './lib/storage';
import { resolveEnginePath, EnginePathResult } from './lib/engine-path';
import { migrateProfileSelection } from './lib/profile-selection-migration';

export interface AppSettings {
  engineMode: 'bundled' | 'path' | 'script';
  engineScriptPath: string;
  customProfilesDirectory: string;
  selectedProfileName: string | null;
  dryRunEnabled: boolean;
  showDetails: boolean;
}

/** Legacy settings shape for one-time migration only */
interface LegacySettings {
  lastSelectedProfile?: string;
  lastSelectedProfilePath?: string;
}

const SETTINGS_KEY = 'endstate-gui-settings';

const DEFAULT_SETTINGS: AppSettings = {
  engineMode: 'bundled',
  engineScriptPath: 'C:\\Users\\win-laptop\\Desktop\\projects\\endstate\\bin\\endstate.ps1',
  customProfilesDirectory: '',
  selectedProfileName: null,
  dryRunEnabled: true,
  showDetails: false,
};

export function loadSettings(): AppSettings {
  try {
    const stored = getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
  return DEFAULT_SETTINGS;
}

/**
 * Load settings with async engine path resolution and migration.
 * This validates and potentially migrates the engine script path.
 * 
 * @returns Settings with resolved/migrated engine path
 */
export async function loadSettingsWithResolution(): Promise<{
  settings: AppSettings;
  pathResolution: EnginePathResult;
}> {
  const settings = loadSettings();
  
  // Only resolve for script mode
  if (settings.engineMode !== 'script') {
    return {
      settings,
      pathResolution: {
        path: null,
        migrated: false,
        resolution: 'path_fallback',
        debugMessage: `Engine mode is '${settings.engineMode}', skipping script path resolution`,
      },
    };
  }
  
  const pathResolution = await resolveEnginePath(settings.engineScriptPath);
  
  // If path was migrated or resolved to a different location, update settings
  if (pathResolution.path && pathResolution.path !== settings.engineScriptPath) {
    const updatedSettings = {
      ...settings,
      engineScriptPath: pathResolution.path,
    };
    
    // Persist the migrated path silently
    saveSettings(updatedSettings);
    
    console.debug('[settings] Engine path migrated:', pathResolution.debugMessage);
    
    return {
      settings: updatedSettings,
      pathResolution,
    };
  }
  
  // Log resolution for debugging
  console.debug('[settings] Engine path resolution:', pathResolution.debugMessage);
  
  return { settings, pathResolution };
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
  const rawSettings: AppSettings & LegacySettings = stored 
    ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }
    : { ...DEFAULT_SETTINGS };
  
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
        engineScriptPath: rawSettings.engineScriptPath,
        customProfilesDirectory: rawSettings.customProfilesDirectory,
        selectedProfileName: migratedName,
        dryRunEnabled: rawSettings.dryRunEnabled,
        showDetails: rawSettings.showDetails,
      };
      saveSettings(updatedSettings);
      console.debug('[settings] Profile selection migrated to name:', migratedName);
      return updatedSettings;
    } else {
      console.debug('[settings] Could not migrate legacy profile selection, clearing selection');
      const updatedSettings: AppSettings = {
        engineMode: rawSettings.engineMode,
        engineScriptPath: rawSettings.engineScriptPath,
        customProfilesDirectory: rawSettings.customProfilesDirectory,
        selectedProfileName: null,
        dryRunEnabled: rawSettings.dryRunEnabled,
        showDetails: rawSettings.showDetails,
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
      engineScriptPath: rawSettings.engineScriptPath,
      customProfilesDirectory: rawSettings.customProfilesDirectory,
      selectedProfileName: rawSettings.lastSelectedProfile,
      dryRunEnabled: rawSettings.dryRunEnabled,
      showDetails: rawSettings.showDetails,
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
