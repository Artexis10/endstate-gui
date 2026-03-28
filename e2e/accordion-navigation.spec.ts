import { test, expect } from '@playwright/test';
import { installTauriMock } from './helpers/tauri-mock';

/**
 * Flow Navigation Regression Test (replaces Accordion Navigation test)
 *
 * The app was refactored from accordion-based OverviewScreen to
 * IntentLanding + SaveFlow/SetupFlow. There are no accordions.
 *
 * This test verifies that navigating between intent flows (save/setup)
 * and settings works correctly, and that flow state is preserved when
 * navigating back to the landing page and re-entering a flow.
 */
test.describe('Flow Navigation', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await installTauriMock(page, {
      invoke: {
        list_manifest_files: ['C:\\test\\profiles\\test-profile.jsonc'],
        validate_profile: () => ({
          valid: true,
          errors: [],
          summary: {
            name: 'test-profile',
            version: 1,
            appCount: 1,
          }
        }),
        check_file_exists: true,
        read_text_file: '{}',
      }
    });

    await page.addInitScript(() => {
      // Mock engine with capture and apply support
      (window as any).__ENDSTATE_MOCK_ENGINE__ = {
        runEndstateStreaming: async (settings: any, command: string, args: string[], onEvent: Function) => {
          if (command === 'capabilities') {
            return { exitCode: 0, envelope: { success: true, data: { commands: ['capture', 'apply', 'report'] } } };
          }
          if (command === 'report') {
            return { exitCode: 0, envelope: { success: true, data: { hasState: false } } };
          }
          if (command === 'capture') {
            onEvent({ type: 'stdout', data: '[OK] Discord.Discord (driver: winget)\n' });
            return {
              exitCode: 0,
              envelope: {
                success: true,
                data: {
                  outputPath: 'C:\\test\\setup.jsonc',
                  counts: { totalFound: 1, included: 1, skipped: 0 },
                  appsIncluded: [{ id: 'Discord.Discord', name: 'Discord', driver: 'winget' }],
                }
              }
            };
          }
          if (command === 'apply') {
            const isDryRun = args.includes('--dry-run');
            if (isDryRun) {
              onEvent({ type: 'stdout', data: '[OK] Discord.Discord - already installed\n' });
              return {
                exitCode: 0,
                envelope: {
                  success: true,
                  data: {
                    dryRun: true,
                    counts: { total: 1, installed: 0, alreadyInstalled: 1, skippedFiltered: 0, failed: 0 },
                    items: [{ id: 'Discord.Discord', driver: 'winget', status: 'ok', reason: 'already_installed' }]
                  }
                }
              };
            }
            return { exitCode: 0, envelope: { success: true, data: {} } };
          }
          return { exitCode: 0, envelope: { success: true, data: {} } };
        }
      };
    });

    await page.goto(baseURL || '/');
    await page.waitForLoadState('networkidle');
  });

  test('can navigate from landing to save flow and back', async ({ page }) => {
    // Verify we're on the intent landing page
    await expect(page.locator('h1:has-text("Endstate")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="intent-save"]')).toBeVisible();
    await expect(page.locator('[data-testid="intent-setup"]')).toBeVisible();

    // Click "Save this computer" to enter save flow
    await page.locator('[data-testid="intent-save"]').click();
    await expect(page.locator('[data-testid="save-flow"]')).toBeVisible({ timeout: 5000 });

    // Verify save flow content is shown
    await expect(page.locator('h2:has-text("Save this computer")')).toBeVisible();

    // Navigate back to landing via back button
    await page.locator('[data-testid="save-flow-back"]').click();

    // Verify we're back on intent landing
    await expect(page.locator('h1:has-text("Endstate")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="intent-save"]')).toBeVisible();
    await expect(page.locator('[data-testid="intent-setup"]')).toBeVisible();
  });

  test('can navigate from landing to setup flow and back', async ({ page }) => {
    // Verify intent landing
    await expect(page.locator('h1:has-text("Endstate")')).toBeVisible({ timeout: 10000 });

    // Click "Set up this computer" to enter setup flow
    await page.locator('[data-testid="intent-setup"]').click();
    await expect(page.locator('[data-testid="setup-flow"]')).toBeVisible({ timeout: 5000 });

    // Verify setup flow content is shown
    await expect(page.locator('h2:has-text("Set up this computer")')).toBeVisible();

    // Navigate back to landing
    await page.locator('[data-testid="setup-flow-back"]').click();

    // Verify we're back on intent landing
    await expect(page.locator('h1:has-text("Endstate")')).toBeVisible({ timeout: 5000 });
  });

  test('can navigate between save and setup flows via landing', async ({ page }) => {
    await expect(page.locator('h1:has-text("Endstate")')).toBeVisible({ timeout: 10000 });

    // Enter save flow
    await page.locator('[data-testid="intent-save"]').click();
    await expect(page.locator('[data-testid="save-flow"]')).toBeVisible({ timeout: 5000 });

    // Go back to landing
    await page.locator('[data-testid="save-flow-back"]').click();
    await expect(page.locator('h1:has-text("Endstate")')).toBeVisible({ timeout: 5000 });

    // Enter setup flow
    await page.locator('[data-testid="intent-setup"]').click();
    await expect(page.locator('[data-testid="setup-flow"]')).toBeVisible({ timeout: 5000 });

    // Go back to landing
    await page.locator('[data-testid="setup-flow-back"]').click();
    await expect(page.locator('h1:has-text("Endstate")')).toBeVisible({ timeout: 5000 });
  });

  test('navigating to settings from a flow and back preserves app state', async ({ page }) => {
    await expect(page.locator('h1:has-text("Endstate")')).toBeVisible({ timeout: 10000 });

    // Enter a flow first - the settings button is in the topbar on flow pages
    // (the topbar is hidden on the landing page)
    await page.locator('[data-testid="intent-save"]').click();
    await expect(page.locator('[data-testid="save-flow"]')).toBeVisible({ timeout: 5000 });

    // Navigate to settings via the settings button (visible on flow pages)
    const settingsBtn = page.locator('button[title="Settings"]');
    await expect(settingsBtn).toBeVisible({ timeout: 3000 });
    await settingsBtn.click();

    // Verify settings page
    await expect(page.locator('h1:has-text("Settings")')).toBeVisible({ timeout: 5000 });

    // Navigate back using the Back button in the topbar
    const backButton = page.locator('button[title="Back to Overview"], button:has-text("Back")').first();
    await expect(backButton).toBeVisible({ timeout: 3000 });
    await backButton.click();

    // After back from settings, we should return to the save flow
    // (previousPage was set to 'save' when navigating to settings)
    await expect(page.locator('[data-testid="save-flow"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('h2:has-text("Save this computer")')).toBeVisible();
  });
});
