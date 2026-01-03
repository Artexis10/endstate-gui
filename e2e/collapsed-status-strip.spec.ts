import { test, expect } from '@playwright/test';
import { forceAdvancedMode, forceDefaultMode, seedProfileSettings, goToApplyPage, goToVerifyPage } from './helpers/ui-mode';

/**
 * Collapsed Status Strip Tests
 * Verifies:
 * 1) Closed card shows last-run strip after a run completes
 * 2) Clicking "Dismiss" returns the card to neutral state
 * 3) Divider is absent in Default mode and present in Advanced/showDetails
 */
test.describe('Collapsed Status Strip', () => {
  test.beforeEach(async ({ page, baseURL }) => {
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
            const isDryRun = args.includes('--dry-run');
            const items = [
              { id: 'app-1', driver: 'winget', status: 'ok', reason: isDryRun ? 'would_install' : 'installed', name: 'Test App 1' },
              { id: 'app-2', driver: 'winget', status: 'ok', reason: 'already_installed', name: 'Test App 2' },
            ];
            
            for (const item of items) {
              if (options?.onNdjsonEvent) {
                options.onNdjsonEvent(item);
              }
              if (onEvent) {
                onEvent({ type: 'stdout', data: JSON.stringify(item) + '\n' });
              }
              await new Promise(r => setTimeout(r, 10));
            }
            
            return { 
              exitCode: 0, 
              envelope: { 
                success: true, 
                data: { 
                  dryRun: isDryRun,
                  installed: isDryRun ? 1 : 1,
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
  });

  test('collapsed card shows status strip after run completes', async ({ page }) => {
    // Expand the Apply card and run preview
    await goToApplyPage(page);
    await page.click('button:has-text("Preview changes")');
    
    // Wait for completion
    await expect(page.locator('text=Completed successfully')).toBeVisible({ timeout: 5000 });
    
    // Collapse the card by clicking elsewhere (the Capture card)
    await page.locator('[data-testid="overview-card-capture"]').click();
    
    // Verify the collapsed status strip appears on the Apply card
    await expect(page.locator('[data-testid="card-status-strip-apply"]')).toBeVisible({ timeout: 3000 });
    
    // Verify strip content
    await expect(page.locator('[data-testid="card-status-strip-apply"]')).toContainText('Completed successfully');
  });

  test('clicking Dismiss on collapsed strip returns card to neutral state', async ({ page }) => {
    // Expand the Apply card and run preview
    await goToApplyPage(page);
    await page.click('button:has-text("Preview changes")');
    
    // Wait for completion
    await expect(page.locator('text=Completed successfully')).toBeVisible({ timeout: 5000 });
    
    // Collapse the card
    await page.locator('[data-testid="overview-card-capture"]').click();
    
    // Verify the collapsed status strip appears
    await expect(page.locator('[data-testid="card-status-strip-apply"]')).toBeVisible({ timeout: 3000 });
    
    // Click the dismiss button on the strip
    await page.locator('[data-testid="card-status-dismiss"]').click();
    
    // Verify the strip is gone
    await expect(page.locator('[data-testid="card-status-strip-apply"]')).not.toBeVisible({ timeout: 3000 });
    
    // Verify the expanded result is also gone (card should be in neutral state)
    await page.locator('[data-testid="overview-card-apply"]').click();
    await expect(page.locator('[data-testid="setup-card-expanded-content"]')).toBeVisible({ timeout: 3000 });
    
    // The "Completed successfully" message should not be visible anymore
    await expect(page.locator('[data-testid="setup-card-expanded-content"]').locator('text=Completed successfully')).not.toBeVisible();
  });

  test('dismiss from expanded card also clears collapsed strip', async ({ page }) => {
    // Expand the Apply card and run preview
    await goToApplyPage(page);
    await page.click('button:has-text("Preview changes")');
    
    // Wait for completion
    await expect(page.locator('text=Completed successfully')).toBeVisible({ timeout: 5000 });
    
    // Click Dismiss button in expanded view
    await page.getByRole('button', { name: 'Dismiss' }).click();
    
    // Collapse the card
    await page.locator('[data-testid="overview-card-capture"]').click();
    
    // Verify no status strip appears (state was cleared)
    await expect(page.locator('[data-testid="card-status-strip-apply"]')).not.toBeVisible({ timeout: 2000 });
  });
});

test.describe('Divider visibility by UI mode', () => {
  test('divider is absent in Default mode', async ({ page, baseURL }) => {
    await forceDefaultMode(page);
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
        runEndstateStreaming: async (settings: any, command: string) => {
          if (command === 'capabilities') {
            return { exitCode: 0, envelope: { success: true, data: { commands: ['capture', 'apply', 'verify', 'report'] } }, ndjsonEvents: [] };
          }
          if (command === 'report') {
            return { exitCode: 0, envelope: { success: true, data: { hasState: false } }, ndjsonEvents: [] };
          }
          return { exitCode: 0, envelope: { success: true, data: {} }, ndjsonEvents: [] };
        }
      };
    });
    
    await page.goto(baseURL || '/');
    await page.waitForLoadState('networkidle');
    
    // Expand the Apply card
    await page.locator('[data-testid="overview-card-apply"]').click();
    await expect(page.locator('[data-testid="setup-card-expanded-content"]')).toBeVisible({ timeout: 5000 });
    
    // Divider should NOT be present in Default mode
    await expect(page.locator('[data-testid="card-divider"]')).not.toBeVisible();
  });

  test('divider is present in Advanced mode', async ({ page, baseURL }) => {
    await forceAdvancedMode(page);
    await seedProfileSettings(page, 'test-profile', true);

    await page.addInitScript(() => {
      // Also set showDetails to true for Advanced mode
      localStorage.setItem('test:endstate-gui-settings', JSON.stringify({
        engineMode: 'path',
        engineScriptPath: '',
        customProfilesDirectory: '',
        lastSelectedProfile: 'test-profile',
        lastSelectedProfilePath: 'C:\\test\\profiles\\test-profile.jsonc',
        dryRunEnabled: true,
        showDetails: true,
      }));
      localStorage.setItem('endstate-gui-settings', JSON.stringify({
        engineMode: 'path',
        engineScriptPath: '',
        customProfilesDirectory: '',
        lastSelectedProfile: 'test-profile',
        lastSelectedProfilePath: 'C:\\test\\profiles\\test-profile.jsonc',
        dryRunEnabled: true,
        showDetails: true,
      }));
      
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
        runEndstateStreaming: async (settings: any, command: string) => {
          if (command === 'capabilities') {
            return { exitCode: 0, envelope: { success: true, data: { commands: ['capture', 'apply', 'verify', 'report'] } }, ndjsonEvents: [] };
          }
          if (command === 'report') {
            return { exitCode: 0, envelope: { success: true, data: { hasState: false } }, ndjsonEvents: [] };
          }
          return { exitCode: 0, envelope: { success: true, data: {} }, ndjsonEvents: [] };
        }
      };
    });
    
    await page.goto(baseURL || '/');
    await page.waitForLoadState('networkidle');
    
    // Expand the Apply card
    await page.locator('[data-testid="overview-card-apply"]').click();
    await expect(page.locator('[data-testid="setup-card-expanded-content"]')).toBeVisible({ timeout: 5000 });
    
    // Divider SHOULD be present in Advanced mode (showDetails=true)
    await expect(page.locator('[data-testid="card-divider"]')).toBeVisible();
  });
});
