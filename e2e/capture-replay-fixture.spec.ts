import { test, expect } from '@playwright/test';
import { forceAdvancedMode } from './helpers/ui-mode';
import { installTauriMock } from './helpers/tauri-mock';

/**
 * E2E Test: Capture Golden Replay Fixture
 *
 * Tests deterministic replay of real NDJSON events from fixture data.
 * Verifies:
 * 1. Event replay produces correct app events
 * 2. Capture results render apps list inline in SaveFlow (not empty)
 * 3. Counters match fixture data
 *
 * Updated for ADR-001 intent-based UI:
 * - Old path: button:has-text("Capture computer") -> overview-card-capture -> action-details-modal
 * - New path: intent-save -> save-flow-start-scan -> inline results in SaveFlow
 */
test.describe('Capture Golden Replay Fixture', () => {
  const FIXTURE_APPS = [
    { id: 'Mozilla.Firefox', driver: 'winget', source: 'winget' },
    { id: 'Google.Chrome', driver: 'winget', source: 'winget' },
    { id: 'Microsoft.VisualStudioCode', driver: 'winget', source: 'winget' },
    { id: 'Notepad++.Notepad++', driver: 'winget', source: 'winget' },
    { id: '9WZDNCRFJ3PZ', driver: 'winget', source: 'msstore' },
  ];

  test.beforeEach(async ({ page, baseURL }) => {
    await forceAdvancedMode(page);
    await installTauriMock(page, {
      allowUnknownInvokes: true,
    });

    await page.addInitScript((apps: typeof FIXTURE_APPS) => {
      (window as any).__ENDSTATE_E2E_SCENARIO__ = 'capture_ok_replay';

      // Mock engine that simulates capture with 5 apps
      (window as any).__ENDSTATE_MOCK_ENGINE__ = {
        runEndstateStreaming: async (settings: any, command: string, args: string[], onEvent: Function, options?: any) => {
          if (command === 'capabilities') {
            return { exitCode: 0, envelope: { success: true, data: { commands: ['capture', 'apply', 'verify', 'report'] } }, ndjsonEvents: [] };
          }
          if (command === 'report') {
            return { exitCode: 0, envelope: { success: true, data: { hasState: false } }, ndjsonEvents: [] };
          }
          if (command === 'capture') {
            const emit = (event: Record<string, unknown>) => {
              options?.onNdjsonEvent?.({
                version: 1,
                runId: 'capture-delayed-store',
                timestamp: new Date().toISOString(),
                ...event,
              });
            };

            emit({ event: 'phase', phase: 'capture' });
            emit({ event: 'progress', phase: 'capture', stage: 'inventory' });
            await new Promise(resolve => setTimeout(resolve, 100));
            emit({ event: 'progress', phase: 'capture', stage: 'settings' });

            // Deliberately keep the first item quiet long enough for stage-only
            // progress to be observable, matching a real package-manager run.
            await new Promise(resolve => setTimeout(resolve, 200));
            for (const app of apps) {
              emit({
                event: 'item',
                id: app.id,
                driver: app.driver,
                status: 'present',
                reason: 'detected',
              });
              if (onEvent) {
                onEvent({ type: 'stderr', data: JSON.stringify({ event: 'item', id: app.id, driver: app.driver }) + '\n' });
              }
            }
            emit({ event: 'progress', phase: 'capture', stage: 'packaging' });

            // Return envelope with captured apps
            const envelope = {
              success: true,
              data: {
                outputPath: 'C:\\test\\profiles\\captured.jsonc',
                counts: { totalFound: 5, included: 5, skipped: 0 },
                appsIncluded: apps.map(a => ({ id: a.id, source: a.source })),
                warnings: [{
                  code: 'store_version_unpinned',
                  message: '1 Store app captured without a version pin',
                  driver: 'winget',
                  source: 'msstore',
                }],
              },
            };

            return { exitCode: 0, envelope, ndjsonEvents: apps.map(a => ({ event: 'item', ...a })) };
          }
          return { exitCode: 0, envelope: { success: true, data: {} }, ndjsonEvents: [] };
        }
      };
    }, FIXTURE_APPS);

    await page.goto(baseURL || '/');
    await page.waitForLoadState('networkidle');
  });

  test('Replay fixture produces non-empty apps list in capture results', async ({ page }) => {
    // Navigate to Save flow via intent landing
    await page.click('[data-testid="intent-save"]');

    // Wait for Save flow to appear
    await expect(page.locator('[data-testid="save-flow"]')).toBeVisible({ timeout: 5000 });

    // Start scan to trigger replay scenario
    await page.click('[data-testid="save-flow-start-scan"]');

    // Progress is visible before the deliberately delayed first item.
    await expect(page.getByText('Checking installed apps…')).toBeVisible();

    // Wait for scan to complete - "Scan complete" text appears
    await expect(page.locator('text=Scan complete')).toBeVisible({ timeout: 15000 });

    // CRITICAL ASSERTION: Apps should be visible in the results
    await expect(page.locator('text=Found 5 apps')).toBeVisible();

    // Verify at least one fixture app ID is visible in the list
    await expect(page.locator('text=Mozilla.Firefox')).toBeVisible();
    await expect(page.getByLabel('Source: Microsoft Store')).toBeVisible();

    // Verify the Save file button is available (scan succeeded)
    await expect(page.locator('[data-testid="save-flow-save-file"]')).toBeVisible();
  });

  test('Replay fixture shows correct count in results', async ({ page }) => {
    // Navigate to Save flow via intent landing
    await page.click('[data-testid="intent-save"]');

    // Wait for Save flow to appear
    await expect(page.locator('[data-testid="save-flow"]')).toBeVisible({ timeout: 5000 });

    // Start scan to trigger replay scenario
    await page.click('[data-testid="save-flow-start-scan"]');

    // Wait for scan to complete
    await expect(page.locator('text=Scan complete')).toBeVisible({ timeout: 15000 });

    // Verify the summary shows correct count (5 apps)
    await expect(page.locator('text=Found 5 apps')).toBeVisible();

    // Verify the filter pill shows correct count
    await expect(page.locator('button:has-text("5 apps")')).toBeVisible();
  });
});
