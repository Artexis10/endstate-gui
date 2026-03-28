import { test, expect } from '@playwright/test';
import { installTauriMock } from './helpers/tauri-mock';

/**
 * Flow Results Display Tests (replaces Collapsed Status Strip tests)
 *
 * The app was refactored from collapsible accordion cards with status strips
 * to full-page flows (IntentLanding -> SaveFlow / SetupFlow).
 *
 * There are no collapsed cards, status strips, or card dividers.
 * These tests verify the equivalent behavior:
 *   1) Setup flow shows results after preview completes
 *   2) Navigating back to profiles resets the result state
 *   3) Layout is consistent across flows
 *
 * NOTE: Uses initialProfileFiles (serializable) instead of function-based
 * custom handlers, since Playwright's addInitScript serializes arguments
 * as JSON and functions are dropped.
 */
test.describe('Flow Results Display', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await installTauriMock(page, {
      initialProfileFiles: ['C:\\test\\profiles\\test-profile.jsonc'],
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

  test('setup flow shows preview results after completion', async ({ page }) => {
    // Navigate to setup flow
    await expect(page.locator('[data-testid="intent-setup"]')).toBeVisible({ timeout: 10000 });
    await page.locator('[data-testid="intent-setup"]').click();
    await expect(page.locator('[data-testid="setup-flow"]')).toBeVisible({ timeout: 5000 });

    // Wait for profile discovery then select the profile card to start preview
    await expect(page.locator('[data-testid="profile-card-test-profile"]')).toBeVisible({ timeout: 10000 });
    await page.locator('[data-testid="profile-card-test-profile"]').click();

    // Wait for preview to complete - shows "Preview complete"
    await expect(page.locator('text=Preview complete')).toBeVisible({ timeout: 10000 });

    // Verify result summary shows counts
    await expect(page.locator('text=/to install.*already present|already present/i')).toBeVisible({ timeout: 3000 });
  });

  test('navigating back to profiles resets result state', async ({ page }) => {
    // Navigate to setup flow
    await expect(page.locator('[data-testid="intent-setup"]')).toBeVisible({ timeout: 10000 });
    await page.locator('[data-testid="intent-setup"]').click();
    await expect(page.locator('[data-testid="setup-flow"]')).toBeVisible({ timeout: 5000 });

    // Wait for profile discovery then select profile and wait for preview
    await expect(page.locator('[data-testid="profile-card-test-profile"]')).toBeVisible({ timeout: 10000 });
    await page.locator('[data-testid="profile-card-test-profile"]').click();
    await expect(page.locator('text=Preview complete')).toBeVisible({ timeout: 10000 });

    // Click "Back to profiles" button to return to profile list
    await page.click('button:has-text("Back to profiles")');

    // Verify we're back to the profile list (result is gone)
    await expect(page.locator('text=Preview complete')).not.toBeVisible({ timeout: 3000 });
    await expect(page.locator('[data-testid="profile-card-test-profile"]')).toBeVisible({ timeout: 3000 });
  });

  test('re-entering setup flow after back-to-landing shows fresh state', async ({ page }) => {
    // Navigate to setup flow
    await expect(page.locator('[data-testid="intent-setup"]')).toBeVisible({ timeout: 10000 });
    await page.locator('[data-testid="intent-setup"]').click();
    await expect(page.locator('[data-testid="setup-flow"]')).toBeVisible({ timeout: 5000 });

    // Wait for profile discovery then select profile and wait for preview
    await expect(page.locator('[data-testid="profile-card-test-profile"]')).toBeVisible({ timeout: 10000 });
    await page.locator('[data-testid="profile-card-test-profile"]').click();
    await expect(page.locator('text=Preview complete')).toBeVisible({ timeout: 10000 });

    // Navigate all the way back to landing
    // First back to profiles
    await page.click('button:has-text("Back to profiles")');
    await expect(page.locator('[data-testid="profile-card-test-profile"]')).toBeVisible({ timeout: 3000 });

    // Then back to landing
    await page.locator('[data-testid="setup-flow-back"]').click();
    await expect(page.locator('h1:has-text("Endstate")')).toBeVisible({ timeout: 5000 });

    // Re-enter setup flow - should show profile list, not old results
    await page.locator('[data-testid="intent-setup"]').click();
    await expect(page.locator('[data-testid="setup-flow"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="profile-card-test-profile"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Preview complete')).not.toBeVisible();
  });
});

test.describe('Flow layout consistency', () => {
  test('save flow has consistent layout structure', async ({ page, baseURL }) => {
    await installTauriMock(page, {
      initialProfileFiles: ['C:\\test\\profiles\\test-profile.jsonc'],
    });

    await page.addInitScript(() => {
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

    // Navigate to save flow
    await expect(page.locator('[data-testid="intent-save"]')).toBeVisible({ timeout: 10000 });
    await page.locator('[data-testid="intent-save"]').click();
    await expect(page.locator('[data-testid="save-flow"]')).toBeVisible({ timeout: 5000 });

    // Verify layout elements
    await expect(page.locator('h2:has-text("Save this computer")')).toBeVisible();
    await expect(page.locator('[data-testid="save-flow-back"]')).toBeVisible();
    await expect(page.locator('[data-testid="save-flow-start-scan"]')).toBeVisible();
  });

  test('setup flow has consistent layout structure', async ({ page, baseURL }) => {
    await installTauriMock(page, {
      initialProfileFiles: ['C:\\test\\profiles\\test-profile.jsonc'],
    });

    await page.addInitScript(() => {
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

    // Navigate to setup flow
    await expect(page.locator('[data-testid="intent-setup"]')).toBeVisible({ timeout: 10000 });
    await page.locator('[data-testid="intent-setup"]').click();
    await expect(page.locator('[data-testid="setup-flow"]')).toBeVisible({ timeout: 5000 });

    // Verify layout elements
    await expect(page.locator('h2:has-text("Set up this computer")')).toBeVisible();
    await expect(page.locator('[data-testid="setup-flow-back"]')).toBeVisible();
    // Profile card should be visible (wait for async discovery)
    await expect(page.locator('[data-testid="profile-card-test-profile"]')).toBeVisible({ timeout: 10000 });
  });
});
