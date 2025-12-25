import { test, expect } from '@playwright/test';
import { forceAdvancedMode, seedProfileSettings, goToApplyPage } from './helpers/ui-mode';

// Helper to create mock engine for Apply-only flow
function createApplyMockEngine(applyResponse: any) {
  return {
    runEndstateStreaming: async (settings: any, command: string, args: string[], onEvent: Function) => {
      if (command === 'capabilities') {
        return { exitCode: 0, envelope: { success: true, data: { commands: ['capture', 'apply', 'report'] } } };
      }
      if (command === 'report') {
        return { exitCode: 0, envelope: { success: true, data: { hasState: false } } };
      }
      if (command === 'apply') {
        return applyResponse;
      }
      return { exitCode: 0, envelope: { success: true, data: {} } };
    }
  };
}

test.describe('Apply Page - Apply Only Flow', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    // Force Advanced mode and seed profile settings
    await forceAdvancedMode(page);
    await seedProfileSettings(page, 'test-profile', true);

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
      
      // Default mock: all apps already installed
      (window as any).__ENDSTATE_MOCK_ENGINE__ = {
        runEndstateStreaming: async (settings: any, command: string, args: string[], onEvent: Function) => {
          if (command === 'capabilities') {
            return { exitCode: 0, envelope: { success: true, data: { commands: ['capture', 'apply', 'report'] } } };
          }
          if (command === 'report') {
            return { exitCode: 0, envelope: { success: true, data: { hasState: false } } };
          }
          if (command === 'apply') {
            // Emit streaming events
            onEvent({ type: 'stdout', data: '[SKIP] Discord.Discord - already installed\n' });
            onEvent({ type: 'stdout', data: '[SKIP] Google.Chrome - already installed\n' });
            
            return { 
              exitCode: 0, 
              envelope: { 
                success: true, 
                data: { 
                  counts: {
                    total: 2,
                    installed: 0,
                    alreadyInstalled: 2,
                    skippedFiltered: 0,
                    failed: 0
                  },
                  items: [
                    { id: 'Discord.Discord', driver: 'winget', status: 'skipped', reason: 'already_installed' },
                    { id: 'Google.Chrome', driver: 'winget', status: 'skipped', reason: 'already_installed' }
                  ]
                } 
              } 
            };
          }
          return { exitCode: 0, envelope: { success: true, data: {} } };
        }
      };
    });
    
    await page.goto(baseURL || '/');
    await page.waitForLoadState('networkidle');
    // App starts on Overview - navigate to Apply page
    await goToApplyPage(page);
  });

  test('Apply page loads with profile selector and Preview button', async ({ page }) => {
    // Profile is pre-selected via seedProfileSettings
    // Preview changes button should be visible (dryRunEnabled=true)
    await expect(page.locator('button:has-text("Preview changes")')).toBeVisible();
  });

  test('Activity card appears during preview', async ({ page }) => {
    // Profile is pre-selected via seedProfileSettings
    // Click Preview changes
    await page.click('button:has-text("Preview changes")');
    
    // Wait for activity card to show
    await expect(page.locator('text=Activity')).toBeVisible({ timeout: 3000 });
  });

  test('Navigation preserves profile selection', async ({ page }) => {
    // Profile is pre-selected via seedProfileSettings
    // Navigate to Capture page
    await page.click('nav >> text=Capture computer');
    await expect(page.locator('h1:has-text("Capture computer")')).toBeVisible();
    
    // Navigate back to Apply page
    await page.click('nav >> text=Set up computer');
    await expect(page.locator('h1:has-text("Set up computer")')).toBeVisible();
    
    // Profile should still be selected (stored in settings)
    await expect(page.locator('button:has-text("Preview changes")')).toBeVisible();
  });
});

// Test: All apps already installed => "Your computer is ready"
test.describe('Apply Modal - All Already Installed', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    // Force Advanced mode and seed profile settings
    await forceAdvancedMode(page);
    await seedProfileSettings(page, 'test-profile', true);

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
      
      (window as any).__ENDSTATE_MOCK_ENGINE__ = {
        runEndstateStreaming: async (settings: any, command: string, args: string[], onEvent: Function) => {
          if (command === 'capabilities') {
            return { exitCode: 0, envelope: { success: true, data: { commands: ['capture', 'apply', 'report'] } } };
          }
          if (command === 'report') {
            return { exitCode: 0, envelope: { success: true, data: { hasState: false } } };
          }
          if (command === 'apply') {
            // All apps already installed
            onEvent({ type: 'stdout', data: '[SKIP] Discord.Discord - already installed\n' });
            onEvent({ type: 'stdout', data: '[SKIP] Google.Chrome - already installed\n' });
            onEvent({ type: 'stdout', data: '[SKIP] 7zip.7zip - already installed\n' });
            
            return { 
              exitCode: 0, 
              envelope: { 
                success: true, 
                data: { 
                  counts: {
                    total: 3,
                    installed: 0,
                    alreadyInstalled: 3,
                    skippedFiltered: 0,
                    failed: 0
                  },
                  items: [
                    { id: 'Discord.Discord', driver: 'winget', status: 'skipped', reason: 'already_installed' },
                    { id: 'Google.Chrome', driver: 'winget', status: 'skipped', reason: 'already_installed' },
                    { id: '7zip.7zip', driver: 'winget', status: 'skipped', reason: 'already_installed' }
                  ]
                } 
              } 
            };
          }
          return { exitCode: 0, envelope: { success: true, data: {} } };
        }
      };
    });
    
    await page.goto(baseURL || '/');
    await page.waitForLoadState('networkidle');
    // App starts on Overview - navigate to Apply page
    await goToApplyPage(page);
  });

  test('shows "Your computer is ready" when all apps already installed', async ({ page }) => {
    // Profile is pre-selected via seedProfileSettings
    // Click Preview changes to run apply --dry-run
    await page.click('button:has-text("Preview changes")');
    
    // Wait for apply modal
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Your computer is ready')).toBeVisible({ timeout: 5000 });
    
    // Should show "Already present" with count 3
    const dialog = page.locator('[role="dialog"]');
    const alreadyPresentCard = dialog.locator('.bg-muted\\/10').filter({ hasText: 'Already present' });
    await expect(alreadyPresentCard).toBeVisible();
    await expect(alreadyPresentCard.locator('.text-2xl')).toHaveText('3');
  });
});

// Test: Some apps failed => "Setup incomplete" + Needs attention
test.describe('Apply Modal - With Failures', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    // Force Advanced mode and seed profile settings
    await forceAdvancedMode(page);
    await seedProfileSettings(page, 'test-profile', true);

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
      
      (window as any).__ENDSTATE_MOCK_ENGINE__ = {
        runEndstateStreaming: async (settings: any, command: string, args: string[], onEvent: Function) => {
          if (command === 'capabilities') {
            return { exitCode: 0, envelope: { success: true, data: { commands: ['capture', 'apply', 'report'] } } };
          }
          if (command === 'report') {
            return { exitCode: 0, envelope: { success: true, data: { hasState: false } } };
          }
          if (command === 'apply') {
            // Some succeed, one fails
            onEvent({ type: 'stdout', data: '[OK] Discord.Discord - installed\n' });
            onEvent({ type: 'stdout', data: '[SKIP] Google.Chrome - already installed\n' });
            onEvent({ type: 'stdout', data: '[FAIL] BrokenApp.App - installation failed\n' });
            
            return { 
              exitCode: 1, 
              envelope: { 
                success: false, 
                data: { 
                  counts: {
                    total: 3,
                    installed: 1,
                    alreadyInstalled: 1,
                    skippedFiltered: 0,
                    failed: 1
                  },
                  items: [
                    { id: 'Discord.Discord', driver: 'winget', status: 'ok', reason: 'installed' },
                    { id: 'Google.Chrome', driver: 'winget', status: 'skipped', reason: 'already_installed' },
                    { id: 'BrokenApp.App', driver: 'winget', status: 'failed', reason: 'install_failed', message: 'Package not found' }
                  ]
                } 
              } 
            };
          }
          return { exitCode: 0, envelope: { success: true, data: {} } };
        }
      };
    });
    
    await page.goto(baseURL || '/');
    await page.waitForLoadState('networkidle');
    // App starts on Overview - navigate to Apply page
    await goToApplyPage(page);
  });

  test('shows "Setup incomplete" and Needs attention when apps fail', async ({ page }) => {
    // Profile is pre-selected via seedProfileSettings
    // Click Preview changes
    await page.click('button:has-text("Preview changes")');
    
    // Wait for apply modal with issues
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Setup incomplete')).toBeVisible({ timeout: 5000 });
    
    // Should show "Needs attention" with count 1
    const dialog = page.locator('[role="dialog"]');
    const needsAttentionCard = dialog.locator('.bg-destructive\\/10').filter({ hasText: 'Needs attention' });
    await expect(needsAttentionCard).toBeVisible();
    await expect(needsAttentionCard.locator('.text-2xl')).toHaveText('1');
    
    // Should NOT show "Your computer is ready"
    await expect(page.locator('text=Your computer is ready')).not.toBeVisible();
  });
});

// Test: Pending installs from dry-run => "Changes ready to apply" with Install button
test.describe('Apply Modal - Pending Installs (Dry Run)', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    // Force Advanced mode and seed profile settings
    await forceAdvancedMode(page);
    await seedProfileSettings(page, 'test-profile', true);

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
      
      (window as any).__ENDSTATE_MOCK_ENGINE__ = {
        runEndstateStreaming: async (settings: any, command: string, args: string[], onEvent: Function) => {
          if (command === 'capabilities') {
            return { exitCode: 0, envelope: { success: true, data: { commands: ['capture', 'apply', 'report'] } } };
          }
          if (command === 'report') {
            return { exitCode: 0, envelope: { success: true, data: { hasState: false } } };
          }
          if (command === 'apply') {
            // Dry run: some apps would be installed
            onEvent({ type: 'stdout', data: '[PLAN] Would install Notepad++.Notepad++\n' });
            onEvent({ type: 'stdout', data: '[SKIP] Google.Chrome - already installed\n' });
            
            return { 
              exitCode: 0, 
              envelope: { 
                success: true, 
                data: { 
                  dryRun: true,
                  counts: {
                    total: 2,
                    installed: 0,
                    alreadyInstalled: 1,
                    skippedFiltered: 0,
                    failed: 0
                  },
                  items: [
                    { id: 'Notepad++.Notepad++', driver: 'winget', status: 'ok', reason: 'would_install' },
                    { id: 'Google.Chrome', driver: 'winget', status: 'skipped', reason: 'already_installed' }
                  ]
                } 
              } 
            };
          }
          return { exitCode: 0, envelope: { success: true, data: {} } };
        }
      };
    });
    
    await page.goto(baseURL || '/');
    await page.waitForLoadState('networkidle');
    // App starts on Overview - navigate to Apply page
    await goToApplyPage(page);
  });

  test('shows "Changes ready to apply" with Install button when apps need installing', async ({ page }) => {
    // Profile is pre-selected via seedProfileSettings
    // Click Preview changes
    await page.click('button:has-text("Preview changes")');
    
    // Wait for apply modal
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog.locator("text=Here's what will change")).toBeVisible({ timeout: 5000 });
    
    // Should show "Will be installed" with count 1
    const pendingCard = dialog.locator('.bg-warning\\/10').filter({ hasText: 'Will be installed' });
    await expect(pendingCard).toBeVisible();
    await expect(pendingCard.locator('.text-2xl')).toHaveText('1');
    
    // Should have Apply changes button
    await expect(dialog.locator('button:has-text("Apply changes")')).toBeVisible();
    
    // Should NOT show "Your computer is ready"
    await expect(page.locator('text=Your computer is ready')).not.toBeVisible();
  });
});
