import { test, expect } from '@playwright/test';

/**
 * Persistence Boundaries E2E Test
 * 
 * Verifies that persisted preferences survive reload while transient UI states reset.
 * 
 * PERSISTED (survive reload):
 * - App settings (lastSelectedProfile, dryRunEnabled, etc.)
 * - Last run data per command
 * - Technical logs visibility preference
 * 
 * TRANSIENT (reset on reload):
 * - Modal open/close state
 * - Technical details expansion in modals
 * - Activity log entries
 * - Current page navigation
 * - Command palette state
 * - Running operation state
 */

test.describe('Persistence Boundaries on Reload', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__TAURI__ = {
        core: {
          invoke: async (cmd: string) => {
            if (cmd === 'ensure_dir') return null;
            if (cmd === 'read_dir') return [];
            if (cmd === 'list_manifest_files') return ['C:\\test\\profiles\\test-profile.jsonc'];
            if (cmd === 'get_default_profiles_directory') return 'C:\\test\\profiles';
            return null;
          }
        }
      };
      
      (window as any).__AUTOSUITE_MOCK_ENGINE__ = {
        runAutosuiteStreaming: async (settings: any, command: string, args: string[], onEvent: Function) => {
          if (command === 'capabilities') {
            return { exitCode: 0, envelope: { success: true, data: { commands: ['capture', 'apply', 'verify', 'report'] } } };
          }
          if (command === 'report') {
            return { exitCode: 0, envelope: { success: true, data: { hasState: false } } };
          }
          if (command === 'apply') {
            onEvent({ type: 'stdout', data: '[SKIP] App1 - already installed\n' });
            return { 
              exitCode: 0, 
              envelope: { 
                success: true, 
                data: { 
                  counts: { total: 1, installed: 0, alreadyInstalled: 1, skippedFiltered: 0, failed: 0 },
                  items: [{ id: 'App1', driver: 'winget', status: 'ok', reason: 'already_installed' }]
                } 
              } 
            };
          }
          return { exitCode: 0, envelope: { success: true, data: {} } };
        }
      };
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('text=Apply', { timeout: 10000 });
  });

  test('persisted preferences survive reload while transient states reset', async ({ page }) => {
    // Step 1: Seed localStorage with persisted preferences
    await page.evaluate(() => {
      const settings = {
        engineMode: 'script',
        engineScriptPath: 'C:\\test\\autosuite.ps1',
        customProfilesDirectory: '',
        lastSelectedProfile: 'test-profile',
        lastSelectedProfilePath: 'C:\\test\\profiles\\test-profile.jsonc',
        dryRunEnabled: false,
      };
      localStorage.setItem('test:autosuite-gui-settings', JSON.stringify(settings));
      
      const lastRun = {
        timestamp: '2024-12-24T10:00:00Z',
        command: 'apply',
        profile: 'test-profile',
        outcome: { installed: 5, alreadyPresent: 3, needsAttention: 1 },
      };
      localStorage.setItem('test:autosuite-last-run-apply', JSON.stringify(lastRun));
    });
    
    // Step 2: Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('text=Apply', { timeout: 10000 });
    
    // Step 3: Verify PERSISTED preferences survived reload
    const afterReload = await page.evaluate(() => {
      const keys = Object.keys(localStorage);
      const settingsKey = keys.find(k => k.includes('autosuite-gui-settings'));
      const lastRunKey = keys.find(k => k.includes('autosuite-last-run-apply'));
      
      const settings = settingsKey ? JSON.parse(localStorage.getItem(settingsKey) || '{}') : null;
      const lastRun = lastRunKey ? JSON.parse(localStorage.getItem(lastRunKey) || '{}') : null;
      
      return {
        hasSettings: !!settingsKey,
        hasLastRun: !!lastRunKey,
        settingsProfile: settings?.lastSelectedProfile,
        lastRunProfile: lastRun?.profile,
        allKeys: keys,
      };
    });
    
    expect(afterReload.hasSettings).toBe(true);
    expect(afterReload.hasLastRun).toBe(true);
    expect(afterReload.settingsProfile).toBe('test-profile');
    expect(afterReload.lastRunProfile).toBe('test-profile');
    
    // Step 4: Verify TRANSIENT states are NOT in localStorage
    const transientCheck = await page.evaluate(() => {
      const keys = Object.keys(localStorage);
      return {
        hasModalState: keys.some(k => k.includes('modal-open')),
        hasDetailsExpanded: keys.some(k => k.includes('details-expanded')),
        hasActivityLog: keys.some(k => k.includes('activity-log')),
        hasCurrentPage: keys.some(k => k.includes('current-page')),
        hasCommandPalette: keys.some(k => k.includes('command-palette')),
        hasRunningState: keys.some(k => k.includes('is-running') || k.includes('check-step')),
      };
    });
    
    expect(transientCheck.hasModalState).toBe(false);
    expect(transientCheck.hasDetailsExpanded).toBe(false);
    expect(transientCheck.hasActivityLog).toBe(false);
    expect(transientCheck.hasCurrentPage).toBe(false);
    expect(transientCheck.hasCommandPalette).toBe(false);
    expect(transientCheck.hasRunningState).toBe(false);
    
    // Step 5: Verify UI defaults (transient states)
    await expect(page.locator('h1:has-text("Set up computer")')).toBeVisible();
    // No running activities should be visible (only "No recent activity" message)
    await expect(page.locator('text=No recent activity')).toBeVisible();
  });

  test('localStorage pollution does not affect transient state initialization', async ({ page }) => {
    // Pollute localStorage with transient state keys
    await page.evaluate(() => {
      localStorage.setItem('web:capture-modal-open', 'true');
      localStorage.setItem('web:apply-modal-open', 'true');
      localStorage.setItem('web:capture-details-expanded', 'true');
      localStorage.setItem('web:apply-details-expanded', 'true');
      localStorage.setItem('web:activity-log', JSON.stringify([{ id: '1', message: 'Test' }]));
      localStorage.setItem('web:current-page', 'capture');
      localStorage.setItem('web:command-palette-open', 'true');
      localStorage.setItem('web:is-running', 'true');
      localStorage.setItem('web:check-step', 'scanning');
    });
    
    // Reload to see if pollution affects initialization
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('text=Apply', { timeout: 10000 });
    
    // Verify app ignores polluted transient state
    
    // Modals should NOT be open
    await expect(page.locator('text=Profile created')).not.toBeVisible();
    await expect(page.locator('text=Here\'s what will change')).not.toBeVisible();
    
    // App should start on Apply page (not Capture)
    await expect(page.locator('h1:has-text("Set up computer")')).toBeVisible();
    
    // No running state should be visible
    await expect(page.locator('[data-status="running"]')).not.toBeVisible();
    
    // Command palette should NOT be open
    await expect(page.locator('[role="dialog"]:has-text("Quick actions")')).not.toBeVisible();
  });

  test('persisted preferences can be updated and persist across reloads', async ({ page }) => {
    // Set initial preference
    await page.evaluate(() => {
      const settings = {
        engineMode: 'script',
        engineScriptPath: 'C:\\test\\autosuite.ps1',
        customProfilesDirectory: '',
        lastSelectedProfile: 'profile-v1',
        lastSelectedProfilePath: 'C:\\test\\profiles\\profile-v1.jsonc',
        dryRunEnabled: true,
      };
      localStorage.setItem('test:autosuite-gui-settings', JSON.stringify(settings));
    });
    
    // Reload
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('text=Apply', { timeout: 10000 });
    
    // Verify first preference persisted
    let persistedSettings = await page.evaluate(() => {
      const settingsKey = Object.keys(localStorage).find(k => k.includes('autosuite-gui-settings'));
      return settingsKey ? JSON.parse(localStorage.getItem(settingsKey) || '{}') : null;
    });
    
    expect(persistedSettings?.lastSelectedProfile).toBe('profile-v1');
    expect(persistedSettings?.dryRunEnabled).toBe(true);
    
    // Update preference
    await page.evaluate(() => {
      const settings = {
        engineMode: 'script',
        engineScriptPath: 'C:\\test\\autosuite.ps1',
        customProfilesDirectory: '',
        lastSelectedProfile: 'profile-v2',
        lastSelectedProfilePath: 'C:\\test\\profiles\\profile-v2.jsonc',
        dryRunEnabled: false,
      };
      localStorage.setItem('test:autosuite-gui-settings', JSON.stringify(settings));
    });
    
    // Reload again
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('text=Apply', { timeout: 10000 });
    
    // Verify updated preference persisted
    persistedSettings = await page.evaluate(() => {
      const settingsKey = Object.keys(localStorage).find(k => k.includes('autosuite-gui-settings'));
      return settingsKey ? JSON.parse(localStorage.getItem(settingsKey) || '{}') : null;
    });
    
    expect(persistedSettings?.lastSelectedProfile).toBe('profile-v2');
    expect(persistedSettings?.dryRunEnabled).toBe(false);
  });
});
