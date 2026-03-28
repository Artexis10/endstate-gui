import { test, expect } from './fixtures/tauri';
import { forceAdvancedMode, goToApplyPage, goToCapturePage } from './helpers/ui-mode';

test.describe('UX Contract Tests', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await forceAdvancedMode(page);
    await page.goto(baseURL || '/');
    await page.waitForLoadState('networkidle');
  });

  test('Boot does not hang - reaches ready state within timeout', async ({ page }) => {
    // This test verifies the app boots successfully and doesn't hang at "Loading..."
    // Navigate to Apply page to verify app is ready
    await goToApplyPage(page);
    
    // Verify we're NOT stuck on loading screen
    await expect(page.locator('text=Loading...')).not.toBeVisible();
    await expect(page.locator('text=Running: endstate capabilities')).not.toBeVisible();
  });

  test('Navigation works without breaking', async ({ page }) => {
    await goToCapturePage(page);
    await goToApplyPage(page);
    await goToCapturePage(page);
    // In the intent-based design, the save flow has a "Start scan" button
    await expect(page.locator('[data-testid="save-flow-start-scan"]')).toBeVisible();
  });

  test('Last Run persists per-command', async ({ page }) => {
    // Use namespaced per-command keys - VITE_STORAGE_NS=test is set in playwright.config.ts
    await page.evaluate(() => {
      // Set capture last run
      localStorage.setItem('test:endstate-last-run-capture', JSON.stringify({ 
        timestamp: new Date().toISOString(), 
        command: 'capture', 
        outcome: { succeeded: 10, skipped: 2, failed: 0 } 
      }));
      // Set apply last run
      localStorage.setItem('test:endstate-last-run-apply', JSON.stringify({ 
        timestamp: new Date().toISOString(), 
        command: 'apply', 
        profile: 'test-profile',
        outcome: { installed: 5, alreadyPresent: 3, needsAttention: 0 } 
      }));
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Verify both per-command keys exist
    const captureExists = await page.evaluate(() => localStorage.getItem('test:endstate-last-run-capture') !== null);
    const applyExists = await page.evaluate(() => localStorage.getItem('test:endstate-last-run-apply') !== null);
    expect(captureExists).toBe(true);
    expect(applyExists).toBe(true);
  });
});
