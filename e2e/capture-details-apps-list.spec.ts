import { test, expect } from '@playwright/test';
import { forceAdvancedMode } from './helpers/ui-mode';

/**
 * E2E Regression Test: Capture Details Apps List
 * 
 * Prevents regression where Capture Details modal shows
 * "No applications were detected on this computer."
 * even when appsIncluded exists in the envelope.
 * 
 * This test exercises the same UI wiring as production:
 * 1. actionResultByAction["capture"] is populated with appEvents from appsIncluded
 * 2. Clicking Details opens ActionDetailsModal with detailsAction="capture"
 * 3. Modal renders apps list (not fallback text)
 * 
 * Uses direct state injection to test the modal rendering logic deterministically,
 * matching the pattern used by other E2E tests in this repo.
 */
test.describe('Capture Details Apps List - Regression Prevention', () => {
  // Fixture apps matching real engine schema
  const FIXTURE_APPS = [
    { id: '7zip.7zip', source: 'winget' },
    { id: 'Git.Git', source: 'winget' },
    { id: 'Docker.DockerDesktop', source: 'winget' },
    { id: 'Microsoft.VSCode', source: 'winget' },
    { id: 'Notepad++.Notepad++', source: 'winget' },
  ];

  test.beforeEach(async ({ page, baseURL }) => {
    await forceAdvancedMode(page);

    await page.addInitScript(() => {
      // Mock Tauri invoke
      (window as any).__TAURI__ = {
        core: {
          invoke: async (cmd: string) => {
            if (cmd === 'ensure_dir') return null;
            if (cmd === 'read_dir') return [];
            if (cmd === 'list_manifest_files') return [];
            if (cmd === 'get_default_profiles_directory') return 'C:\\test\\profiles';
            if (cmd === 'get_capture_cache_directory') return 'C:\\test\\cache';
            if (cmd === 'read_text_file') return '{"version": 1, "apps": []}';
            if (cmd === 'check_file_exists') return false;
            if (cmd === 'validate_profile') return { valid: true, summary: { name: 'test', version: 1, appCount: 0 } };
            if (cmd === 'delete_file' || cmd === 'delete_file_silent') return null;
            if (cmd === 'rename_file') return null;
            return null;
          }
        }
      };

      // Mock engine for capabilities/report only
      (window as any).__ENDSTATE_MOCK_ENGINE__ = {
        runEndstateStreaming: async (_settings: any, command: string) => {
          if (command === 'capabilities') {
            return { exitCode: 0, envelope: { success: true, data: { commands: ['capture', 'apply', 'verify', 'report'] } } };
          }
          if (command === 'report') {
            return { exitCode: 0, envelope: { success: true, data: { hasState: false } } };
          }
          return { exitCode: 0, envelope: { success: true, data: {} } };
        }
      };
    });

    await page.goto(baseURL || '/');
    await page.waitForLoadState('networkidle');
  });

  test('REGRESSION: Capture Details shows apps list when appsIncluded exists (not fallback text)', async ({ page }) => {
    // Inject capture result state and open modal directly (same pattern as other E2E tests)
    // This simulates what happens after handleCaptureFromOverview completes
    await page.evaluate((fixtureApps) => {
      // Build appEvents from appsIncluded (same as buildCaptureActionResult)
      const appEvents = fixtureApps.map((app: any) => ({
        app: app.id,
        action: 'Captured',
        timestamp: Date.now(),
        statusKey: 'detected',
        phase: 'capture',
      }));

      // Inject the capture result into the app state
      (window as any).__endstate_e2e_setCaptureResult?.({
        action: 'capture',
        status: 'success',
        summary: `${fixtureApps.length} apps captured`,
        timestamp: new Date().toISOString(),
        counts: { total: fixtureApps.length },
        appEvents,
      });

      // Open the details modal directly
      (window as any).__endstate_e2e_openDetailsModal?.('capture');
    }, FIXTURE_APPS);

    // Wait for modal to open
    await page.waitForTimeout(300);

    // Verify modal is open with correct title
    const modal = page.locator('[data-testid="action-details-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });
    await expect(modal.locator('text=Capture Details')).toBeVisible();

    // CRITICAL ASSERTION - Apps list should be visible
    const appsList = page.locator('[data-testid="action-details-apps-list"]');
    await expect(appsList).toBeVisible({ timeout: 5000 });

    // Verify at least one fixture app ID is visible in the list
    await expect(appsList.locator('text=7zip.7zip')).toBeVisible();

    // CRITICAL ASSERTION - Fallback text should NOT be visible
    const fallback = page.locator('[data-testid="action-details-fallback"]');
    await expect(fallback).not.toBeVisible();

    // Also verify the specific fallback text is not present anywhere in the modal
    await expect(modal.locator('text=No applications were detected on this computer.')).not.toBeVisible();
    await expect(modal.locator('text=Apps were captured but the list is unavailable.')).not.toBeVisible();
  });

  test('Capture Details shows correct app count in header', async ({ page }) => {
    // Inject capture result state and open modal
    await page.evaluate((fixtureApps) => {
      const appEvents = fixtureApps.map((app: any) => ({
        app: app.id,
        action: 'Captured',
        timestamp: Date.now(),
        statusKey: 'detected',
        phase: 'capture',
      }));

      (window as any).__endstate_e2e_setCaptureResult?.({
        action: 'capture',
        status: 'success',
        summary: `${fixtureApps.length} apps captured`,
        timestamp: new Date().toISOString(),
        counts: { total: fixtureApps.length },
        appEvents,
      });

      // Open the details modal directly
      (window as any).__endstate_e2e_openDetailsModal?.('capture');
    }, FIXTURE_APPS);

    await page.waitForTimeout(300);

    const modal = page.locator('[data-testid="action-details-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Verify the summary shows correct count (5 apps captured)
    await expect(modal.locator('text=5 apps captured')).toBeVisible();

    // Verify the apps list header shows correct count
    await expect(modal.locator('text=Apps (5)')).toBeVisible();
  });
});
