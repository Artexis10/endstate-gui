import { getItem, setItem } from './lib/storage';

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
  engineScriptPath: 'C:\\Users\\win-laptop\\Desktop\\projects\\endstate\\endstate.ps1',
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

export function saveSettings(settings: AppSettings): void {
  try {
    setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save settings:', err);
  }
}
