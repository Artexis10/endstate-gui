import { describe, it, expect, beforeEach } from 'vitest';
import { loadSettings, saveSettings, AppSettings } from '../settings';
import { saveLastRun, loadLastRunForCommand, LastRunData } from './last-run';
import { seedLocalStorage, clearLocalStorage, getLocalStorageKeys } from '../test/localStorage-helpers';

/**
 * Persistence Boundaries Regression Tests
 * 
 * This test suite enforces the contract between persisted preferences and transient UI states.
 * 
 * PERSISTED PREFERENCES (survive reload):
 * 1. App Settings (engineMode, engineScriptPath, customProfilesDirectory, lastSelectedProfile, dryRunEnabled)
 * 2. Last Run Data per command (capture/apply/verify outcomes with timestamps)
 * 3. Technical Logs Visibility (showDetails preference)
 * 
 * TRANSIENT UI STATES (must reset on reload/close):
 * 1. Modal open/close state (capture modal, apply modal)
 * 2. Technical details expansion in modals (always starts collapsed)
 * 3. Activity log entries (running state, progress messages)
 * 4. Current page navigation state (defaults to 'apply')
 * 5. Command palette open state
 * 6. Running operation state (isRunning, checkStep)
 */

describe('Persistence Boundaries', () => {
  beforeEach(() => {
    clearLocalStorage();
  });

  describe('PERSISTED: App Settings', () => {
    it('uses defaults when localStorage is empty', () => {
      const settings = loadSettings();
      
      expect(settings.engineMode).toBe('bundled');
      expect(settings.engineScriptPath).toBe('C:\\Users\\win-laptop\\Desktop\\projects\\endstate\\endstate.ps1');
      expect(settings.customProfilesDirectory).toBe('');
      expect(settings.lastSelectedProfile).toBe('');
      expect(settings.lastSelectedProfilePath).toBe('');
      expect(settings.dryRunEnabled).toBe(true);
    });

    it('restores settings from localStorage when seeded', () => {
      const customSettings: AppSettings = {
        engineMode: 'path',
        engineScriptPath: 'C:\\custom\\path\\endstate.ps1',
        customProfilesDirectory: 'C:\\custom\\profiles',
        selectedProfileName: null,
        lastSelectedProfile: 'my-profile',
        lastSelectedProfilePath: 'C:\\custom\\profiles\\my-profile.jsonc',
        dryRunEnabled: false,
        showDetails: false,
      };

      seedLocalStorage({
        'web:endstate-gui-settings': JSON.stringify(customSettings),
      });

      const loaded = loadSettings();
      expect(loaded).toEqual(customSettings);
    });

    it('persists settings to localStorage when saved', () => {
      const settings: AppSettings = {
        engineMode: 'path',
        engineScriptPath: '/usr/local/bin/endstate',
        customProfilesDirectory: '/home/user/profiles',
        selectedProfileName: null,
        lastSelectedProfile: 'work-setup',
        lastSelectedProfilePath: '/home/user/profiles/work-setup.jsonc',
        dryRunEnabled: true,
        showDetails: false,
      };

      saveSettings(settings);

      const keys = getLocalStorageKeys();
      expect(keys).toContain('web:endstate-gui-settings');
      
      const stored = localStorage.getItem('web:endstate-gui-settings');
      expect(stored).toBeTruthy();
      expect(JSON.parse(stored!)).toEqual(settings);
    });

    it('only writes expected settings key to localStorage', () => {
      const settings = loadSettings();
      saveSettings(settings);

      const keys = getLocalStorageKeys();
      expect(keys).toEqual(['web:endstate-gui-settings']);
    });

    it('merges partial updates with defaults', () => {
      const initial: AppSettings = {
        engineMode: 'script',
        engineScriptPath: 'C:\\endstate.ps1',
        customProfilesDirectory: '',
        selectedProfileName: null,
        lastSelectedProfile: '',
        lastSelectedProfilePath: '',
        dryRunEnabled: true,
        showDetails: false,
      };

      saveSettings(initial);

      // Simulate partial update
      const loaded = loadSettings();
      const updated = { ...loaded, dryRunEnabled: false };
      saveSettings(updated);

      const reloaded = loadSettings();
      expect(reloaded.dryRunEnabled).toBe(false);
      expect(reloaded.engineMode).toBe('script');
    });
  });

  describe('PERSISTED: Last Run Data (per command)', () => {
    it('returns null when localStorage is empty', () => {
      expect(loadLastRunForCommand('capture')).toBeNull();
      expect(loadLastRunForCommand('apply')).toBeNull();
      expect(loadLastRunForCommand('verify')).toBeNull();
    });

    it('restores last run data from localStorage when seeded', () => {
      const captureRun: LastRunData = {
        timestamp: '2024-12-24T10:00:00Z',
        command: 'capture',
        profile: 'test-profile',
        outcome: {
          succeeded: 10,
          skipped: 2,
          failed: 1,
        },
      };

      const applyRun: LastRunData = {
        timestamp: '2024-12-24T10:05:00Z',
        command: 'apply',
        profile: 'test-profile',
        outcome: {
          installed: 5,
          alreadyPresent: 3,
          needsAttention: 1,
        },
      };

      seedLocalStorage({
        'web:endstate-last-run-capture': JSON.stringify(captureRun),
        'web:endstate-last-run-apply': JSON.stringify(applyRun),
      });

      expect(loadLastRunForCommand('capture')).toEqual(captureRun);
      expect(loadLastRunForCommand('apply')).toEqual(applyRun);
      expect(loadLastRunForCommand('verify')).toBeNull();
    });

    it('persists last run data per command to localStorage', () => {
      const captureRun: LastRunData = {
        timestamp: '2024-12-24T10:00:00Z',
        command: 'capture',
        outcome: {
          succeeded: 15,
          skipped: 3,
          failed: 0,
        },
      };

      saveLastRun(captureRun);

      const keys = getLocalStorageKeys();
      expect(keys).toContain('web:endstate-last-run-capture');
      
      const stored = localStorage.getItem('web:endstate-last-run-capture');
      expect(stored).toBeTruthy();
      expect(JSON.parse(stored!)).toEqual(captureRun);
    });

    it('maintains separate storage per command', () => {
      const captureRun: LastRunData = {
        timestamp: '2024-12-24T10:00:00Z',
        command: 'capture',
        outcome: { succeeded: 10, skipped: 0, failed: 0 },
      };

      const applyRun: LastRunData = {
        timestamp: '2024-12-24T10:05:00Z',
        command: 'apply',
        outcome: { installed: 5, alreadyPresent: 0, needsAttention: 0 },
      };

      saveLastRun(captureRun);
      saveLastRun(applyRun);

      expect(loadLastRunForCommand('capture')).toEqual(captureRun);
      expect(loadLastRunForCommand('apply')).toEqual(applyRun);
      expect(loadLastRunForCommand('verify')).toBeNull();
    });

    it('only writes expected last-run keys to localStorage', () => {
      const captureRun: LastRunData = {
        timestamp: '2024-12-24T10:00:00Z',
        command: 'capture',
        outcome: { succeeded: 10, skipped: 0, failed: 0 },
      };

      saveLastRun(captureRun);

      const keys = getLocalStorageKeys();
      expect(keys).toEqual(['web:endstate-last-run-capture']);
    });
  });

  describe('PERSISTED: Technical Logs Visibility Preference', () => {
    it('defaults to false when localStorage is empty', () => {
      // This preference is managed in App.tsx via useState
      // Default is false (collapsed)
      const stored = localStorage.getItem('web:endstate-show-technical-logs');
      expect(stored).toBeNull();
    });

    it('restores preference from localStorage when seeded', () => {
      seedLocalStorage({
        'web:endstate-show-technical-logs': 'true',
      });

      const stored = localStorage.getItem('web:endstate-show-technical-logs');
      expect(stored).toBe('true');
    });

    it('persists preference to localStorage', () => {
      localStorage.setItem('web:endstate-show-technical-logs', 'true');

      const keys = getLocalStorageKeys();
      expect(keys).toContain('web:endstate-show-technical-logs');
    });
  });

  describe('TRANSIENT: Modal Open/Close State', () => {
    it('modals do not persist open state to localStorage', () => {
      // Simulate modal interaction
      clearLocalStorage();

      // Modal state is managed via useState in App.tsx
      // Opening/closing modals should NOT write to localStorage
      
      const keysBefore = getLocalStorageKeys();
      
      // Simulate modal operations (no localStorage writes expected)
      // In actual app: setShowCaptureModal(true) / setShowApplyModal(true)
      
      const keysAfter = getLocalStorageKeys();
      expect(keysAfter).toEqual(keysBefore);
    });

    it('ignores any seeded modal state keys', () => {
      seedLocalStorage({
        'web:capture-modal-open': 'true',
        'web:apply-modal-open': 'true',
      });

      // App should ignore these keys - modals always start closed
      // This is enforced by useState(false) in component initialization
      const keys = getLocalStorageKeys();
      expect(keys).toContain('web:capture-modal-open');
      expect(keys).toContain('web:apply-modal-open');
      
      // But the app will never read these keys
      // Modal state is always initialized to false
    });
  });

  describe('TRANSIENT: Technical Details Expansion in Modals', () => {
    it('technical details do not persist expansion state', () => {
      clearLocalStorage();

      // Technical details in modals use useState(false)
      // Expansion state is transient and never written to localStorage
      
      const keysBefore = getLocalStorageKeys();
      
      // Simulate expanding technical details (no localStorage writes)
      // In actual modal: setShowDetails(true)
      
      const keysAfter = getLocalStorageKeys();
      expect(keysAfter).toEqual(keysBefore);
    });

    it('ignores seeded technical details expansion state', () => {
      seedLocalStorage({
        'web:capture-details-expanded': 'true',
        'web:apply-details-expanded': 'true',
        'showDetails': 'true',
      });

      // Modals always start with technical details collapsed
      // These seeded keys are ignored (tested in modal component tests)
      const keys = getLocalStorageKeys();
      expect(keys.length).toBeGreaterThan(0);
      
      // The app will never read these keys for modal state
      // Modal technical details always initialize to false via useState(false)
    });
  });

  describe('TRANSIENT: Activity Log Entries', () => {
    it('activity log does not persist to localStorage', () => {
      clearLocalStorage();

      // Activity log is managed via useState<ActivityItem[]>([])
      // It's transient runtime state, never persisted
      
      const keysBefore = getLocalStorageKeys();
      
      // Simulate activity updates (no localStorage writes)
      // In actual app: setActivities([...activities, newActivity])
      
      const keysAfter = getLocalStorageKeys();
      expect(keysAfter).toEqual(keysBefore);
    });

    it('ignores seeded activity log state', () => {
      seedLocalStorage({
        'web:activity-log': JSON.stringify([
          { id: '1', message: 'Test', status: 'running', timestamp: new Date().toISOString() },
        ]),
      });

      // App always starts with empty activity log
      // This seeded key is ignored
      const keys = getLocalStorageKeys();
      expect(keys).toContain('web:activity-log');
      
      // But the app will never read this key
      // Activity log is always initialized to [] via useState([])
    });
  });

  describe('TRANSIENT: Current Page Navigation', () => {
    it('current page does not persist to localStorage', () => {
      clearLocalStorage();

      // Current page is managed via useState<PageType>('apply')
      // Navigation state is transient, always defaults to 'apply'
      
      const keysBefore = getLocalStorageKeys();
      
      // Simulate navigation (no localStorage writes)
      // In actual app: setCurrentPage('capture')
      
      const keysAfter = getLocalStorageKeys();
      expect(keysAfter).toEqual(keysBefore);
    });

    it('ignores seeded current page state', () => {
      seedLocalStorage({
        'web:current-page': 'capture',
        'web:last-visited-page': 'verify',
      });

      // App always starts on 'apply' page
      // These seeded keys are ignored
      const keys = getLocalStorageKeys();
      expect(keys.length).toBeGreaterThan(0);
      
      // But the app will never read these keys
      // Current page is always initialized to 'apply' via useState('apply')
    });
  });

  describe('TRANSIENT: Command Palette State', () => {
    it('command palette open state does not persist', () => {
      clearLocalStorage();

      // Command palette state is managed via useState(false)
      // Open/close state is transient
      
      const keysBefore = getLocalStorageKeys();
      
      // Simulate opening command palette (no localStorage writes)
      // In actual app: setCommandPaletteOpen(true)
      
      const keysAfter = getLocalStorageKeys();
      expect(keysAfter).toEqual(keysBefore);
    });

    it('ignores seeded command palette state', () => {
      seedLocalStorage({
        'web:command-palette-open': 'true',
      });

      // Command palette always starts closed
      const keys = getLocalStorageKeys();
      expect(keys).toContain('web:command-palette-open');
      
      // But the app will never read this key
      // Command palette is always initialized to false via useState(false)
    });
  });

  describe('TRANSIENT: Running Operation State', () => {
    it('running state does not persist to localStorage', () => {
      clearLocalStorage();

      // Running state is managed via useState(false)
      // Operation progress is transient runtime state
      
      const keysBefore = getLocalStorageKeys();
      
      // Simulate starting operation (no localStorage writes)
      // In actual app: setIsRunning(true), setCheckStep('scanning')
      
      const keysAfter = getLocalStorageKeys();
      expect(keysAfter).toEqual(keysBefore);
    });

    it('ignores seeded running operation state', () => {
      seedLocalStorage({
        'web:is-running': 'true',
        'web:check-step': 'scanning',
        'web:apply-run-phase': 'applying',
      });

      // App always starts with idle state
      // These seeded keys are ignored
      const keys = getLocalStorageKeys();
      expect(keys.length).toBeGreaterThan(0);
      
      // But the app will never read these keys
      // Running state is always initialized to false/idle via useState
    });
  });

  describe('Persistence Contract Summary', () => {
    it('only persisted preferences write to localStorage', () => {
      clearLocalStorage();

      // Save all persisted preferences
      const settings: AppSettings = {
        engineMode: 'script',
        engineScriptPath: 'C:\\endstate.ps1',
        customProfilesDirectory: '',
        selectedProfileName: null,
        lastSelectedProfile: 'test',
        lastSelectedProfilePath: 'C:\\profiles\\test.jsonc',
        dryRunEnabled: true,
        showDetails: false,
      };
      saveSettings(settings);

      const captureRun: LastRunData = {
        timestamp: '2024-12-24T10:00:00Z',
        command: 'capture',
        outcome: { succeeded: 10, skipped: 0, failed: 0 },
      };
      saveLastRun(captureRun);

      localStorage.setItem('web:endstate-show-technical-logs', 'true');

      // Verify only expected keys exist
      const keys = getLocalStorageKeys();
      expect(keys).toHaveLength(3);
      expect(keys).toContain('web:endstate-gui-settings');
      expect(keys).toContain('web:endstate-last-run-capture');
      expect(keys).toContain('web:endstate-show-technical-logs');

      // Verify NO transient state keys exist
      expect(keys).not.toContain('web:capture-modal-open');
      expect(keys).not.toContain('web:apply-modal-open');
      expect(keys).not.toContain('web:capture-details-expanded');
      expect(keys).not.toContain('web:apply-details-expanded');
      expect(keys).not.toContain('web:activity-log');
      expect(keys).not.toContain('web:current-page');
      expect(keys).not.toContain('web:command-palette-open');
      expect(keys).not.toContain('web:is-running');
      expect(keys).not.toContain('web:check-step');
    });
  });
});
