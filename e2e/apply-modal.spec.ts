import { test, expect } from '@playwright/test';

test.describe('Apply Modal and Navigation Persistence', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await page.addInitScript(() => {
      // Mock Tauri
      (window as any).__TAURI__ = {
        core: {
          invoke: async (cmd: string, args?: any) => {
            if (cmd === 'ensure_dir') return null;
            if (cmd === 'read_dir') return [];
            if (cmd === 'list_manifest_files') return [
              'C:\\test\\profiles\\test-profile.jsonc'
            ];
            if (cmd === 'get_default_profiles_directory') return 'C:\\test\\profiles';
            return null;
          }
        }
      };
      
      // Mock engine with streaming apply
      (window as any).__AUTOSUITE_MOCK_ENGINE__ = {
        runAutosuiteStreaming: async (settings: any, command: string, args: string[], onEvent: Function) => {
          if (command === 'capabilities') {
            return { exitCode: 0, envelope: { success: true, data: { commands: ['capture', 'apply', 'verify', 'report'] } } };
          }
          if (command === 'report') {
            return { exitCode: 0, envelope: { success: true, data: { hasState: false } } };
          }
          if (command === 'verify') {
            // Return all OK so no modal appears
            return { 
              exitCode: 0, 
              envelope: { 
                success: true, 
                data: { 
                  summary: { total: 3, okCount: 3, missingCount: 0, versionMismatchCount: 0 }, 
                  results: [
                    { id: 'Discord.Discord', status: 'ok' },
                    { id: 'Google.Chrome', status: 'ok' },
                    { id: '7zip.7zip', status: 'ok' }
                  ] 
                } 
              } 
            };
          }
          if (command === 'apply') {
            // Emit streaming events with delays
            const lines = [
              '[ACTION] Installing Google.Chrome via winget',
              '[OK] Google.Chrome (driver: winget) - installed',
              '[OK] Discord.Discord (driver: winget) - already installed',
              '[OK] 7zip.7zip (driver: winget) - installed',
            ];
            
            for (const line of lines) {
              await new Promise(r => setTimeout(r, 150));
              onEvent({ type: 'stdout', data: line + '\n' });
            }
            
            // Return envelope with counts and items
            return { 
              exitCode: 0, 
              envelope: { 
                success: true, 
                data: { 
                  manifestPath: 'C:\\test\\profiles\\test-profile.jsonc',
                  installed: 2,
                  skipped: 1,
                  failed: 0,
                  counts: {
                    total: 3,
                    installed: 2,
                    alreadyInstalled: 1,
                    skippedFiltered: 0,
                    failed: 0
                  },
                  items: [
                    { id: 'Google.Chrome', driver: 'winget', status: 'ok', reason: 'installed' },
                    { id: 'Discord.Discord', driver: 'winget', status: 'skipped', reason: 'already_installed' },
                    { id: '7zip.7zip', driver: 'winget', status: 'ok', reason: 'installed' }
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
    // Wait for app to be ready (Apply page is default)
    await expect(page.locator('h1:has-text("Apply")')).toBeVisible({ timeout: 5000 });
  });

  test('Apply page loads with profile selector', async ({ page }) => {
    // Wait for select to have the profile option
    await page.waitForSelector('select option[value="test-profile"]', { state: 'attached', timeout: 3000 });
    
    // Select a profile
    await page.selectOption('select', 'test-profile');
    
    // Check button should be visible
    await expect(page.locator('button:has-text("Check this computer")')).toBeVisible();
  });

  test('Activity card appears during check', async ({ page }) => {
    // Wait for select to have the profile option
    await page.waitForSelector('select option[value="test-profile"]', { state: 'attached', timeout: 3000 });
    
    // Select profile and start check
    await page.selectOption('select', 'test-profile');
    await page.click('button:has-text("Check this computer")');
    
    // Wait for activity card to show
    await expect(page.locator('text=Activity')).toBeVisible({ timeout: 3000 });
  });

  test('Navigation preserves app state', async ({ page }) => {
    // Wait for select to have the profile option
    await page.waitForSelector('select option[value="test-profile"]', { state: 'attached', timeout: 3000 });
    
    // Select a profile
    await page.selectOption('select', 'test-profile');
    
    // Navigate to Capture page (sidebar label)
    await page.click('nav >> text=Capture machine');
    await expect(page.locator('h1:has-text("Capture machine")')).toBeVisible();
    
    // Navigate back to Apply page (sidebar label is "Apply")
    await page.click('nav >> text=Apply');
    await expect(page.locator('h1:has-text("Apply")')).toBeVisible();
    
    // Profile should still be selected
    await expect(page.locator('select')).toHaveValue('test-profile');
  });
});

// Test: All apps already installed => "Your computer is ready" + Up to date count
test.describe('Apply Modal - All Up To Date', () => {
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
            return { exitCode: 0, envelope: { success: true, data: { commands: ['capture', 'apply', 'verify', 'report'] } } };
          }
          if (command === 'report') {
            return { exitCode: 0, envelope: { success: true, data: { hasState: false } } };
          }
          if (command === 'verify') {
            // Return some missing so Fix button appears
            return { 
              exitCode: 0, 
              envelope: { 
                success: true, 
                data: { 
                  summary: { total: 3, okCount: 0, missingCount: 3, versionMismatchCount: 0 }, 
                  results: [
                    { id: 'Discord.Discord', status: 'missing' },
                    { id: 'Google.Chrome', status: 'missing' },
                    { id: '7zip.7zip', status: 'missing' }
                  ] 
                } 
              } 
            };
          }
          if (command === 'apply') {
            // All apps already installed - no new installs
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

  test('shows "Your computer is ready" and Up to date count when all apps already installed', async ({ page }) => {
    await page.waitForSelector('select option[value="test-profile"]', { state: 'attached', timeout: 3000 });
    await page.selectOption('select', 'test-profile');
    
    // Click Check to trigger verify
    await page.click('button:has-text("Check this computer")');
    
    // Wait for scan result modal and click Install missing apps
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[role="dialog"] button:has-text("Install missing apps")').click();
    
    // Wait for apply modal
    await expect(page.locator('text=Your computer is ready')).toBeVisible({ timeout: 5000 });
    
    // Should show "Up to date" label with count 3 in the summary card
    const dialog = page.locator('[role="dialog"]');
    const upToDateCard = dialog.locator('.bg-success\\/10').filter({ hasText: 'Up to date' });
    await expect(upToDateCard).toBeVisible();
    await expect(upToDateCard.locator('.text-2xl')).toHaveText('3');
  });
});

// Test: Some apps failed => "Setup complete with issues" + Needs attention section
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
            return { exitCode: 0, envelope: { success: true, data: { commands: ['capture', 'apply', 'verify', 'report'] } } };
          }
          if (command === 'report') {
            return { exitCode: 0, envelope: { success: true, data: { hasState: false } } };
          }
          if (command === 'verify') {
            return { 
              exitCode: 0, 
              envelope: { 
                success: true, 
                data: { 
                  summary: { total: 3, okCount: 0, missingCount: 3, versionMismatchCount: 0 }, 
                  results: [
                    { id: 'Discord.Discord', status: 'missing' },
                    { id: 'Google.Chrome', status: 'missing' },
                    { id: 'BrokenApp.App', status: 'missing' }
                  ] 
                } 
              } 
            };
          }
          if (command === 'apply') {
            // Some succeed, one fails
            onEvent({ type: 'stdout', data: '[OK] Discord.Discord - installed\n' });
            onEvent({ type: 'stdout', data: '[OK] Google.Chrome - already installed\n' });
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

  test('shows "Setup complete with issues" and Needs attention when apps fail', async ({ page }) => {
    await page.waitForSelector('select option[value="test-profile"]', { state: 'attached', timeout: 3000 });
    await page.selectOption('select', 'test-profile');
    
    // Click Check to trigger verify
    await page.click('button:has-text("Check this computer")');
    
    // Wait for scan result modal and click Install missing apps
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[role="dialog"] button:has-text("Install missing apps")').click();
    
    // Wait for apply modal with issues
    await expect(page.locator('text=Setup complete with issues')).toBeVisible({ timeout: 5000 });
    
    // Should show "Needs attention" label with count 1 in the summary card
    const dialog = page.locator('[role="dialog"]');
    const needsAttentionCard = dialog.locator('.bg-destructive\\/10').filter({ hasText: 'Needs attention' });
    await expect(needsAttentionCard).toBeVisible();
    await expect(needsAttentionCard.locator('.text-2xl')).toHaveText('1');
    
    // Should NOT show "Your computer is ready"
    await expect(page.locator('text=Your computer is ready')).not.toBeVisible();
  });
});
