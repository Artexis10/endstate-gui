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
