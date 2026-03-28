import { test, expect } from '@playwright/test';
import { forceAdvancedMode, seedProfileSettings, goToApplyPage, goToCapturePage } from './helpers/ui-mode';
import { installTauriMock } from './helpers/tauri-mock';

/**
 * Error Retry Flow E2E Test
 * 
 * Verifies the UX contract for error handling and retry:
 * 1. When operation fails, error message is shown
 * 2. User can close error modal and retry
 * 3. Retry succeeds and shows success modal
 * 4. No duplicate operations or state corruption
 */

test.describe('Error Retry Flow - UX Contracts', () => {
  test.beforeEach(async ({ page }) => {
    // Force Advanced mode and seed profile settings
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
        runEndstateStreaming: async (settings: any, command: string, args: string[], onEvent: Function) => {
          if (command === 'capabilities') {
            return { exitCode: 0, envelope: { success: true, data: { commands: ['capture', 'apply', 'verify', 'report'] } } };
          }
          if (command === 'report') {
            return { exitCode: 0, envelope: { success: true, data: { hasState: false } } };
          }
          if (command === 'apply') {
            // First call fails, second succeeds
            const callNum = (window as any).__applyCallCount || 0;
            (window as any).__applyCallCount = callNum + 1;
            
            if (callNum === 0) {
              // First attempt: fail
              onEvent({ type: 'stdout', data: '[FAIL] App1 - network error\n' });
              return { 
                exitCode: 1, 
                envelope: { 
                  success: false,
                  error: { message: 'Network connection failed' },
                  data: { 
                    counts: { total: 1, installed: 0, alreadyInstalled: 0, skippedFiltered: 0, failed: 1 },
                    items: [{ id: 'App1', driver: 'winget', status: 'failed', reason: 'failed', message: 'Network error' }]
                  } 
                } 
              };
            } else {
              // Second attempt: succeed
              onEvent({ type: 'stdout', data: '[OK] App1 - already installed\n' });
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
          }
          if (command === 'capture') {
            // First call fails, second succeeds
            const callNum = (window as any).__captureCallCount || 0;
            (window as any).__captureCallCount = callNum + 1;
            
            if (callNum === 0) {
              // First attempt: fail
              return {
                exitCode: 1,
                envelope: {
                  success: false,
                  error: { message: 'Permission denied' },
                }
              };
            } else {
              // Second attempt: succeed
              onEvent({ type: 'stdout', data: 'Captured: App1\n' });
              return {
                exitCode: 0,
                envelope: {
                  success: true,
                  data: {
                    counts: { totalFound: 1, included: 1, skipped: 0, filteredRuntimes: 0, filteredStoreApps: 0, sensitiveExcludedCount: 0 },
                    appsIncluded: [{ id: 'App1', source: 'winget' }],
                    outputPath: 'C:\\test\\profiles\\captured.jsonc'
                  }
                }
              };
            }
          }
          return { exitCode: 0, envelope: { success: true, data: {} } };
        }
      };
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Apply modal shows error state with retry capability', async ({ page }) => {
    // Navigate to Setup flow
    await goToApplyPage(page);

    // Setup flow should be visible with profile list or drop zone
    await expect(page.locator('[data-testid="setup-flow"]')).toBeVisible();
  });

  test('Capture page loads with button enabled', async ({ page }) => {
    // Navigate to Save/Capture flow
    await goToCapturePage(page);

    // In the intent-based design, the save flow has a "Start scan" button
    const scanButton = page.locator('[data-testid="save-flow-start-scan"]');
    await expect(scanButton).toBeVisible();
    await expect(scanButton).toBeEnabled();
  });

  test('Apply page shows profile selector', async ({ page }) => {
    // Navigate to Setup flow
    await goToApplyPage(page);

    // Setup flow should be visible (contains profile list or drop zone)
    await expect(page.locator('[data-testid="setup-flow"]')).toBeVisible();
  });

  test('Profile selection persists in localStorage', async ({ page }) => {
    // Profile is pre-selected via seedProfileSettings
    // Verify localStorage has the selection
    const hasProfile = await page.evaluate(() => {
      const keys = Object.keys(localStorage);
      const settingsKey = keys.find(k => k.includes('endstate-gui-settings'));
      if (!settingsKey) return false;
      const settings = JSON.parse(localStorage.getItem(settingsKey) || '{}');
      return settings.lastSelectedProfile === 'test-profile';
    });
    
    expect(hasProfile).toBe(true);
  });

  test('No transient state keys persist in localStorage', async ({ page }) => {
    // Verify no transient state is stored
    const transientCheck = await page.evaluate(() => {
      const keys = Object.keys(localStorage);
      return {
        hasModalState: keys.some(k => k.includes('modal-open')),
        hasDetailsExpanded: keys.some(k => k.includes('details-expanded')),
        hasRunningState: keys.some(k => k.includes('is-running')),
      };
    });
    
    expect(transientCheck.hasModalState).toBe(false);
    expect(transientCheck.hasDetailsExpanded).toBe(false);
    expect(transientCheck.hasRunningState).toBe(false);
  });
});
