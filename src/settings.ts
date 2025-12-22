export interface AppSettings {
  engineMode: 'path' | 'script';
  engineScriptPath: string;
  customProfilesDirectory: string;
  lastSelectedProfile: string;
  lastSelectedProfilePath: string;
  dryRunEnabled: boolean;
}

const SETTINGS_KEY = 'autosuite-gui-settings';

const DEFAULT_SETTINGS: AppSettings = {
  engineMode: 'script',
  engineScriptPath: 'C:\\Users\\win-laptop\\Desktop\\projects\\autosuite\\autosuite.ps1',
  customProfilesDirectory: '',
  lastSelectedProfile: '',
  lastSelectedProfilePath: '',
  dryRunEnabled: true,
};

export function loadSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
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
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save settings:', err);
  }
}
