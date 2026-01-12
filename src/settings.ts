import { getItem, setItem } from './lib/storage';
import { resolveEnginePath, EnginePathResult } from './lib/engine-path';

export interface AppSettings {
  engineMode: 'bundled' | 'path' | 'script';
  engineScriptPath: string;
  customProfilesDirectory: string;
  lastSelectedProfile: string;
  lastSelectedProfilePath: string;
  dryRunEnabled: boolean;
  showDetails: boolean;
}

const SETTINGS_KEY = 'endstate-gui-settings';

const DEFAULT_SETTINGS: AppSettings = {
  engineMode: 'bundled',
  engineScriptPath: 'C:\\Users\\win-laptop\\Desktop\\projects\\endstate\\bin\\endstate.ps1',
  customProfilesDirectory: '',
  lastSelectedProfile: '',
  lastSelectedProfilePath: '',
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
