import { test, expect } from '@playwright/test';
import { forceAdvancedMode } from './helpers/ui-mode';
import { installTauriMock } from './helpers/tauri-mock';

/**
 * E2E Regression Test: Capture Details Apps List
 *
 * Prevents regression where capture results show no apps even when
 * appsIncluded exists in the envelope.
 *
 * Updated for ADR-001 intent-based UI:
 * 1. Navigate to Save flow via intent-save card
 * 2. Start scan via save-flow-start-scan
 * 3. After scan completes, verify apps are shown inline in the save flow
 *
 * The old ActionDetailsModal path (overview-card-capture -> capture-details-button)
 * has been replaced by inline app rendering in the SaveFlow component.
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
    await installTauriMock(page, {
      allowUnknownInvokes: true,
    });

    await page.addInitScript((fixtureApps: typeof FIXTURE_APPS) => {
      (window as any).__ENDSTATE_MOCK_ENGINE__ = {
        runEndstateStreaming: async (settings: any, command: string, args: string[], onEvent: Function, options?: any) => {
          if (command === 'capabilities') {
            return { exitCode: 0, envelope: { success: true, data: { commands: ['capture', 'apply', 'verify', 'report'] } }, ndjsonEvents: [] };
          }
          if (command === 'report') {
            return { exitCode: 0, envelope: { success: true, data: { hasState: false } }, ndjsonEvents: [] };
          }
          if (command === 'capture') {
            // Return envelope with captured apps
            const envelope = {
              success: true,
              data: {
                outputPath: 'C:\\test\\profiles\\captured.jsonc',
                counts: { totalFound: fixtureApps.length, included: fixtureApps.length, skipped: 0 },
                appsIncluded: fixtureApps.map((a: any) => ({ id: a.id, source: a.source })),
              },
            };
            return { exitCode: 0, envelope, ndjsonEvents: [] };
          }
          return { exitCode: 0, envelope: { success: true, data: {} }, ndjsonEvents: [] };
        }
      };
    }, FIXTURE_APPS);

    await page.goto(baseURL || '/');
    await page.waitForLoadState('networkidle');
  });

  test('REGRESSION: Capture results show apps list when appsIncluded exists (not empty state)', async ({ page }) => {
    // Navigate to Save flow via intent landing
    await page.click('[data-testid="intent-save"]');

    // Wait for Save flow to appear
    await expect(page.locator('[data-testid="save-flow"]')).toBeVisible({ timeout: 5000 });

    // Start scan
    await page.click('[data-testid="save-flow-start-scan"]');

    // Wait for scan to complete - "Scan complete" text appears
    await expect(page.locator('text=Scan complete')).toBeVisible({ timeout: 15000 });

    // CRITICAL ASSERTION: Apps should be visible in the results
    // The save flow shows "Found N apps" text
    await expect(page.locator(`text=Found ${FIXTURE_APPS.length} apps`)).toBeVisible();

    // Verify at least one fixture app ID is visible in the list
    // The SaveFlow uses formatAppIdentity which renders the app ID
    await expect(page.locator('text=7zip.7zip')).toBeVisible();

    // CRITICAL ASSERTION: The filter pill (button) showing app count should be visible
    await expect(page.locator(`button:has-text("${FIXTURE_APPS.length} apps")`)).toBeVisible();
  });

  test('Capture results show correct app count after scan', async ({ page }) => {
    // Navigate to Save flow via intent landing
    await page.click('[data-testid="intent-save"]');

    // Wait for Save flow to appear
    await expect(page.locator('[data-testid="save-flow"]')).toBeVisible({ timeout: 5000 });

    // Start scan
    await page.click('[data-testid="save-flow-start-scan"]');

    // Wait for scan to complete
    await expect(page.locator('text=Scan complete')).toBeVisible({ timeout: 15000 });

    // Verify the summary shows correct count (5 apps)
    await expect(page.locator(`text=Found ${FIXTURE_APPS.length} apps`)).toBeVisible();

    // Verify the filter pill shows correct count
    await expect(page.locator(`button:has-text("${FIXTURE_APPS.length} apps")`)).toBeVisible();

    // Verify the Save file button is available
    await expect(page.locator('[data-testid="save-flow-save-file"]')).toBeVisible();
  });
});
