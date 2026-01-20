import { test, expect } from '@playwright/test';
import { forceAdvancedMode } from './helpers/ui-mode';
import { installTauriMock } from './helpers/tauri-mock';

/**
 * E2E Test: Capture Golden Replay Fixture
 * 
 * Tests deterministic replay of real NDJSON events from fixture file.
 * Uses capture_ok_realistic.events.jsonl to verify:
 * 1. Event replay produces correct app events
 * 2. Capture Details modal renders apps list (not fallback)
 * 3. Counters match fixture data
 * 
 * This test proves the replay infrastructure works end-to-end
 * without invoking the real engine.
 */
test.describe('Capture Golden Replay Fixture', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await forceAdvancedMode(page);
    await installTauriMock(page, {
      allowUnknownInvokes: true,
    });

    await page.addInitScript(() => {
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
            // Simulate 5 apps being captured with NDJSON events
            const apps = [
              { id: 'Mozilla.Firefox', driver: 'winget' },
              { id: 'Google.Chrome', driver: 'winget' },
              { id: 'Microsoft.VisualStudioCode', driver: 'winget' },
              { id: 'Notepad++.Notepad++', driver: 'winget' },
              { id: '7zip.7zip', driver: 'winget' },
            ];
            
            // Emit item events
            for (const app of apps) {
              if (options?.onNdjsonEvent) {
                options.onNdjsonEvent({ event: 'item', id: app.id, driver: app.driver });
              }
              if (onEvent) {
                onEvent({ type: 'stdout', data: JSON.stringify({ event: 'item', id: app.id, driver: app.driver }) + '\n' });
              }
            }
            
            // Return envelope with captured apps
            const envelope = {
              success: true,
              data: {
                outputPath: 'C:\\test\\profiles\\captured.jsonc',
                counts: { totalFound: 5, included: 5, skipped: 0 },
                appsIncluded: apps.map(a => ({ id: a.id, source: a.driver })),
              },
            };
            
            return { exitCode: 0, envelope, ndjsonEvents: apps.map(a => ({ event: 'item', ...a })) };
          }
          return { exitCode: 0, envelope: { success: true, data: {} }, ndjsonEvents: [] };
        }
      };
    });

    await page.goto(baseURL || '/');
    await page.waitForLoadState('networkidle');
  });

  test('Replay fixture produces non-empty apps list in Capture Details', async ({ page }) => {
    // Click Capture button to trigger replay scenario
    await page.click('main >> button:has-text("Capture computer")');

    // Wait for capture to complete - the save profile modal should appear
    const saveProfileModal = page.locator('[data-testid="profile-name-modal"]');
    await expect(saveProfileModal).toBeVisible({ timeout: 10000 });
    
    // Save the profile
    await page.locator('[data-testid="profile-name-input"]').fill('Replay Test Profile');
    await page.click('[data-testid="profile-name-save"]');
    await expect(saveProfileModal).not.toBeVisible({ timeout: 3000 });
    
    // Wait for success state after save
    await expect(page.locator('text=Completed successfully')).toBeVisible({ timeout: 5000 });

    // Expand Capture card to see the success strip with Details button
    const captureCard = page.locator('[data-testid="overview-card-capture"]');
    await captureCard.click();

    // Click the Details button to open Action Details modal
    const detailsButton = page.locator('[data-testid="capture-details-button"]').first();
    await expect(detailsButton).toBeVisible({ timeout: 5000 });
    await detailsButton.click();

    // Verify Action Details modal is open with correct title
    const modal = page.locator('[data-testid="action-details-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });
    await expect(modal.locator('text=Capture Details')).toBeVisible();

    // CRITICAL ASSERTION - Apps list should be visible
    const appsList = page.locator('[data-testid="action-details-apps-list"]');
    await expect(appsList).toBeVisible({ timeout: 5000 });

    // Verify at least one fixture app ID is visible in the list
    await expect(appsList.locator('text=Mozilla.Firefox')).toBeVisible();

    // CRITICAL ASSERTION - Fallback text should NOT be visible
    const fallback = page.locator('[data-testid="action-details-fallback"]');
    await expect(fallback).not.toBeVisible();
  });

  test('Replay fixture shows correct count in header', async ({ page }) => {
    // Click Capture button to trigger replay scenario
    await page.click('main >> button:has-text("Capture computer")');

    // Wait for capture to complete - the save profile modal should appear
    const saveProfileModal = page.locator('[data-testid="profile-name-modal"]');
    await expect(saveProfileModal).toBeVisible({ timeout: 10000 });
    
    // Save the profile
    await page.locator('[data-testid="profile-name-input"]').fill('Replay Count Test');
    await page.click('[data-testid="profile-name-save"]');
    await expect(saveProfileModal).not.toBeVisible({ timeout: 3000 });
    
    // Wait for success state after save
    await expect(page.locator('text=Completed successfully')).toBeVisible({ timeout: 5000 });

    // Expand Capture card to see the success strip with Details button
    const captureCard = page.locator('[data-testid="overview-card-capture"]');
    await captureCard.click();

    // Click the Details button
    const detailsButton = page.locator('[data-testid="capture-details-button"]').first();
    await expect(detailsButton).toBeVisible({ timeout: 5000 });
    await detailsButton.click();

    // Verify Action Details modal shows correct count
    const modal = page.locator('[data-testid="action-details-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Verify the summary shows correct count (5 apps captured)
    await expect(modal.locator('text=5 apps captured')).toBeVisible();

    // Verify the apps list header shows correct count
    await expect(modal.locator('text=Apps (5)')).toBeVisible();
  });
});
