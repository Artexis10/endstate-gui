import { test, expect } from '@playwright/test';

// Helper to create mock engine for Apply-only flow
function createApplyMockEngine(applyResponse: any) {
  return {
    runAutosuiteStreaming: async (settings: any, command: string, args: string[], onEvent: Function) => {
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
      (window as any).__AUTOSUITE_MOCK_ENGINE__ = {
        runAutosuiteStreaming: async (settings: any, command: string, args: string[], onEvent: Function) => {
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
    await expect(page.locator('h1:has-text("Apply")')).toBeVisible({ timeout: 5000 });
  });

  test('Apply page loads with profile selector and Preview button', async ({ page }) => {
    await page.waitForSelector('select option[value="test-profile"]', { state: 'attached', timeout: 3000 });
    await page.selectOption('select', 'test-profile');
    
    // Preview changes button should be visible (not "Check this computer")
    await expect(page.locator('button:has-text("Preview changes")')).toBeVisible();
  });

  test('Activity card appears during preview', async ({ page }) => {
    await page.waitForSelector('select option[value="test-profile"]', { state: 'attached', timeout: 3000 });
    await page.selectOption('select', 'test-profile');
    
    // Click Preview changes
    await page.click('button:has-text("Preview changes")');
    
    // Wait for activity card to show
    await expect(page.locator('text=Activity')).toBeVisible({ timeout: 3000 });
  });

  test('Navigation preserves profile selection', async ({ page }) => {
    await page.waitForSelector('select option[value="test-profile"]', { state: 'attached', timeout: 3000 });
    await page.selectOption('select', 'test-profile');
    
    // Navigate to Capture page
    await page.click('nav >> text=Capture machine');
    await expect(page.locator('h1:has-text("Capture machine")')).toBeVisible();
    
    // Navigate back to Apply page
    await page.click('nav >> text=Apply');
    await expect(page.locator('h1:has-text("Apply")')).toBeVisible();
    
    // Profile should still be selected
    await expect(page.locator('select')).toHaveValue('test-profile');
  });
});

// Test: All apps already installed => "Your computer is ready"
test.describe('Apply Modal - All Already Installed', () => {
  test.beforeEach(async ({ page, baseURL }) => {
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
    await expect(page.locator('h1:has-text("Apply")')).toBeVisible({ timeout: 5000 });
  });

  test('shows "Your computer is ready" when all apps already installed', async ({ page }) => {
    await page.waitForSelector('select option[value="test-profile"]', { state: 'attached', timeout: 3000 });
    await page.selectOption('select', 'test-profile');
    
    // Click Preview changes to run apply --dry-run
    await page.click('button:has-text("Preview changes")');
    
    // Wait for apply modal
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Your computer is ready')).toBeVisible({ timeout: 5000 });
    
    // Should show "Already installed" with count 3
    const dialog = page.locator('[role="dialog"]');
    const alreadyInstalledCard = dialog.locator('.bg-success\\/10').filter({ hasText: 'Already installed' });
    await expect(alreadyInstalledCard).toBeVisible();
    await expect(alreadyInstalledCard.locator('.text-2xl')).toHaveText('3');
  });
});

// Test: Some apps failed => "Setup incomplete" + Needs attention
test.describe('Apply Modal - With Failures', () => {
  test.beforeEach(async ({ page, baseURL }) => {
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
    await expect(page.locator('h1:has-text("Apply")')).toBeVisible({ timeout: 5000 });
  });

  test('shows "Setup incomplete" and Needs attention when apps fail', async ({ page }) => {
    await page.waitForSelector('select option[value="test-profile"]', { state: 'attached', timeout: 3000 });
    await page.selectOption('select', 'test-profile');
    
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
    await expect(page.locator('h1:has-text("Apply")')).toBeVisible({ timeout: 5000 });
  });

  test('shows "Changes ready to apply" with Install button when apps need installing', async ({ page }) => {
    await page.waitForSelector('select option[value="test-profile"]', { state: 'attached', timeout: 3000 });
    await page.selectOption('select', 'test-profile');
    
    // Click Preview changes
    await page.click('button:has-text("Preview changes")');
    
    // Wait for apply modal
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Changes ready to apply')).toBeVisible({ timeout: 5000 });
    
    // Should show "Will be installed" with count 1
    const dialog = page.locator('[role="dialog"]');
    const pendingCard = dialog.locator('.bg-warning\\/10').filter({ hasText: 'Will be installed' });
    await expect(pendingCard).toBeVisible();
    await expect(pendingCard.locator('.text-2xl')).toHaveText('1');
    
    // Should have Install button
    await expect(dialog.locator('button:has-text("Install 1 app")')).toBeVisible();
    
    // Should NOT show "Your computer is ready"
    await expect(page.locator('text=Your computer is ready')).not.toBeVisible();
  });
});
