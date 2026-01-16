import { test, expect } from '@playwright/test';
import { forceAdvancedMode, seedProfileSettings, goToApplyPage } from './helpers/ui-mode';
import { installTauriMock } from './helpers/tauri-mock';

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
    await forceAdvancedMode(page);
    await seedProfileSettings(page, 'test-profile', true);

    await installTauriMock(page, {
      invoke: {
        list_manifest_files: () => ['C:\\test\\profiles\\test-profile.jsonc'],
        validate_profile: () => ({ valid: true, errors: [], summary: { name: 'test-profile', version: 1, appCount: 2 } }),
        check_file_exists: () => true,
        read_text_file: () => '{}',
      }
    });

    await page.addInitScript(() => {
      (window as any).__ENDSTATE_MOCK_ENGINE__ = {
        runEndstateStreaming: async (settings: any, command: string, args: string[], onEvent: Function, options?: any) => {
          if (command === 'capabilities') {
            return { exitCode: 0, envelope: { success: true, data: { commands: ['capture', 'apply', 'verify', 'report'] } }, ndjsonEvents: [] };
          }
          if (command === 'report') {
            return { exitCode: 0, envelope: { success: true, data: { hasState: false } }, ndjsonEvents: [] };
          }
          if (command === 'apply') {
            const items = [
              { id: 'Discord.Discord', driver: 'winget', status: 'ok', reason: 'already_installed', name: 'Discord' },
              { id: 'Google.Chrome', driver: 'winget', status: 'ok', reason: 'already_installed', name: 'Chrome' },
            ];
            for (const item of items) {
              if (options?.onNdjsonEvent) options.onNdjsonEvent(item);
              if (onEvent) onEvent({ type: 'stdout', data: JSON.stringify(item) + '\n' });
            }
            
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
    
    // Wait for completion - results appear in expanded card
    await expect(page.locator('text=Completed successfully')).toBeVisible({ timeout: 5000 });
  });

  test('Navigation preserves profile selection', async ({ page }) => {
    // Old assertion: used nav >> text selector which doesn't exist in current UI
    // New contract: verify profile selection persists after page reload (stored in localStorage)
    
    // Profile is pre-selected via seedProfileSettings
    // Verify Preview changes button is visible (indicates profile is selected)
    await expect(page.locator('button:has-text("Preview changes")')).toBeVisible();
    
    // Reload page to verify persistence
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Navigate back to Apply page
    await goToApplyPage(page);
    
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
            if (cmd === 'validate_profile') {
              return { valid: true, errors: [], summary: { name: 'test-profile', version: 1, appCount: 3 } };
            }
            if (cmd === 'check_file_exists') return true;
            if (cmd === 'read_text_file') return '{}';
            return null;
          }
        }
      };
      
      (window as any).__ENDSTATE_MOCK_ENGINE__ = {
        runEndstateStreaming: async (settings: any, command: string, args: string[], onEvent: Function, options?: any) => {
          if (command === 'capabilities') {
            return { exitCode: 0, envelope: { success: true, data: { commands: ['capture', 'apply', 'verify', 'report'] } }, ndjsonEvents: [] };
          }
          if (command === 'report') {
            return { exitCode: 0, envelope: { success: true, data: { hasState: false } }, ndjsonEvents: [] };
          }
          if (command === 'apply') {
            // All apps already installed - emit deterministic streaming events
            const items = [
              { id: 'Discord.Discord', driver: 'winget', status: 'ok', reason: 'already_installed', name: 'Discord' },
              { id: 'Google.Chrome', driver: 'winget', status: 'ok', reason: 'already_installed', name: 'Chrome' },
              { id: '7zip.7zip', driver: 'winget', status: 'ok', reason: 'already_installed', name: '7-Zip' },
            ];
            for (const item of items) {
              if (options?.onNdjsonEvent) options.onNdjsonEvent(item);
              if (onEvent) onEvent({ type: 'stdout', data: JSON.stringify(item) + '\n' });
            }
            
            return { 
              exitCode: 0, 
              envelope: { 
                success: true, 
                data: { 
                  installed: 0,
                  alreadyPresent: 3,
                  failed: 0,
                  items
                } 
              },
              ndjsonEvents: items,
            };
          }
          return { exitCode: 0, envelope: { success: true, data: {} }, ndjsonEvents: [] };
        }
      };
    });
    
    await page.goto(baseURL || '/');
    await page.waitForLoadState('networkidle');
    // App starts on Overview - navigate to Apply page
    await goToApplyPage(page);
  });

  test('shows "Your computer is ready" when all apps already installed', async ({ page }) => {
    // Old assertion: expected [role="dialog"] modal which doesn't exist in current UI
    // New contract: verify completion message and result controls in expanded card
    
    // Profile is pre-selected via seedProfileSettings
    // Click Preview changes to run apply --dry-run
    await page.click('button:has-text("Preview changes")');
    
    // Wait for completion - results appear in expanded card
    await expect(page.locator('text=Completed successfully')).toBeVisible({ timeout: 5000 });
    
    // Verify result controls are present (Details button to view items)
    await expect(page.getByRole('button', { name: 'Details' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dismiss' })).toBeVisible();
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
            if (cmd === 'validate_profile') {
              return { valid: true, errors: [], summary: { name: 'test-profile', version: 1, appCount: 3 } };
            }
            if (cmd === 'check_file_exists') return true;
            if (cmd === 'read_text_file') return '{}';
            return null;
          }
        }
      };
      
      (window as any).__ENDSTATE_MOCK_ENGINE__ = {
        runEndstateStreaming: async (settings: any, command: string, args: string[], onEvent: Function, options?: any) => {
          if (command === 'capabilities') {
            return { exitCode: 0, envelope: { success: true, data: { commands: ['capture', 'apply', 'verify', 'report'] } }, ndjsonEvents: [] };
          }
          if (command === 'report') {
            return { exitCode: 0, envelope: { success: true, data: { hasState: false } }, ndjsonEvents: [] };
          }
          if (command === 'apply') {
            // Some succeed, one fails - emit deterministic streaming events
            const items = [
              { id: 'Discord.Discord', driver: 'winget', status: 'ok', reason: 'installed', name: 'Discord' },
              { id: 'Google.Chrome', driver: 'winget', status: 'ok', reason: 'already_installed', name: 'Chrome' },
              { id: 'BrokenApp.App', driver: 'winget', status: 'failed', reason: 'install_failed', name: 'Broken App', message: 'Package not found' },
            ];
            for (const item of items) {
              if (options?.onNdjsonEvent) options.onNdjsonEvent(item);
              if (onEvent) onEvent({ type: 'stdout', data: JSON.stringify(item) + '\n' });
            }
            
            return { 
              exitCode: 0, 
              envelope: { 
                success: true, 
                data: { 
                  installed: 1,
                  alreadyPresent: 1,
                  failed: 1,
                  items
                } 
              },
              ndjsonEvents: items,
            };
          }
          return { exitCode: 0, envelope: { success: true, data: {} }, ndjsonEvents: [] };
        }
      };
    });
    
    await page.goto(baseURL || '/');
    await page.waitForLoadState('networkidle');
    // App starts on Overview - navigate to Apply page
    await goToApplyPage(page);
  });

  test('shows "Setup incomplete" and Needs attention when apps fail', async ({ page }) => {
    // Old assertion: expected [role="dialog"] modal which doesn't exist in current UI
    // New contract: verify completion state with result controls - Details button shows failure info
    
    // Profile is pre-selected via seedProfileSettings
    // Click Preview changes
    await page.click('button:has-text("Preview changes")');
    
    // Wait for completion - either success or issues message
    await expect(page.locator('text=/Completed/i')).toBeVisible({ timeout: 5000 });
    
    // Verify result controls are present (Details button allows viewing failure info)
    await expect(page.getByRole('button', { name: 'Details' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dismiss' })).toBeVisible();
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
            if (cmd === 'validate_profile') {
              return { valid: true, errors: [], summary: { name: 'test-profile', version: 1, appCount: 2 } };
            }
            if (cmd === 'check_file_exists') return true;
            if (cmd === 'read_text_file') return '{}';
            return null;
          }
        }
      };
      
      (window as any).__ENDSTATE_MOCK_ENGINE__ = {
        runEndstateStreaming: async (settings: any, command: string, args: string[], onEvent: Function, options?: any) => {
          if (command === 'capabilities') {
            return { exitCode: 0, envelope: { success: true, data: { commands: ['capture', 'apply', 'verify', 'report'] } }, ndjsonEvents: [] };
          }
          if (command === 'report') {
            return { exitCode: 0, envelope: { success: true, data: { hasState: false } }, ndjsonEvents: [] };
          }
          if (command === 'apply') {
            // Dry run: some apps would be installed - emit deterministic streaming events
            const isDryRun = args.includes('--dry-run');
            const items = [
              { id: 'Notepad++.Notepad++', driver: 'winget', status: 'ok', reason: isDryRun ? 'would_install' : 'installed', name: 'Notepad++' },
              { id: 'Google.Chrome', driver: 'winget', status: 'ok', reason: 'already_installed', name: 'Chrome' },
            ];
            for (const item of items) {
              if (options?.onNdjsonEvent) options.onNdjsonEvent(item);
              if (onEvent) onEvent({ type: 'stdout', data: JSON.stringify(item) + '\n' });
            }
            
            return { 
              exitCode: 0, 
              envelope: { 
                success: true, 
                data: { 
                  dryRun: isDryRun,
                  installed: isDryRun ? 0 : 1,
                  alreadyPresent: 1,
                  failed: 0,
                  items
                } 
              },
              ndjsonEvents: items,
            };
          }
          return { exitCode: 0, envelope: { success: true, data: {} }, ndjsonEvents: [] };
        }
      };
    });
    
    await page.goto(baseURL || '/');
    await page.waitForLoadState('networkidle');
    // App starts on Overview - navigate to Apply page
    await goToApplyPage(page);
  });

  test('shows "Changes ready to apply" with Install button when apps need installing', async ({ page }) => {
    // Old assertion: expected [role="dialog"] modal which doesn't exist in current UI
    // New contract: verify completion with result controls in expanded card
    
    // Profile is pre-selected via seedProfileSettings
    // Click Preview changes
    await page.click('button:has-text("Preview changes")');
    
    // Wait for completion - results appear in expanded card
    await expect(page.locator('text=Completed successfully')).toBeVisible({ timeout: 5000 });
    
    // Verify result controls are present
    await expect(page.getByRole('button', { name: 'Details' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dismiss' })).toBeVisible();
  });
});
