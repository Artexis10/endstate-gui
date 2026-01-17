import { test, expect } from './fixtures/tauri';
import { forceAdvancedMode, goToApplyPage, goToCapturePage, goToVerifyPage } from './helpers/ui-mode';

/**
 * Navigation Smoke Test
 * 
 * Verifies basic navigation between all pages works correctly.
 * Does NOT depend on profiles, preview, or any operation execution.
 * Only checks stable landmarks (page headings) exist after navigation.
 * 
 * NOTE: These tests require Advanced mode (sidebar navigation visible).
 * App always starts on Overview; tests navigate explicitly.
 */

test.describe('Navigation Smoke', () => {
  test.use({
    tauriMockOptions: {
      invoke: {
        list_manifest_files: () => [],
      }
    }
  });

  test.beforeEach(async ({ page }) => {
    // Force Advanced mode for sidebar navigation tests
    await forceAdvancedMode(page);

    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('navigates through all pages and verifies stable landmarks', async ({ page }) => {
    // App starts on Overview - navigate to Apply first
    await goToApplyPage(page);
    
    // Navigate to Capture
    await goToCapturePage(page);
    
    // Navigate to Verify (Check computer)
    await goToVerifyPage(page);
    
    // Navigate to Settings
    await page.locator('nav >> button:has-text("Settings")').click();
    await expect(page.locator('h1:has-text("Settings")')).toBeVisible({ timeout: 5000 });
    
    // Navigate back to Apply (Set up computer)
    await goToApplyPage(page);
  });

  test('each page has unique stable heading', async ({ page }) => {
    // App starts on Overview - navigate to Apply first
    await goToApplyPage(page);
    
    // Capture page
    await goToCapturePage(page);
    await expect(page.locator('h1:has-text("Set up computer")')).not.toBeVisible();
    
    // Verify page
    await goToVerifyPage(page);
    await expect(page.locator('h1:has-text("Capture computer")')).not.toBeVisible();
    
    // Settings page
    await page.locator('nav >> button:has-text("Settings")').click();
    await expect(page.locator('h1:has-text("Settings")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('h1:has-text("Check computer")')).not.toBeVisible();
  });

  test('navigation preserves app state (no crashes)', async ({ page }) => {
    // Navigate through all pages multiple times
    for (let i = 0; i < 2; i++) {
      await goToCapturePage(page);
      await goToVerifyPage(page);
      
      await page.locator('nav >> button:has-text("Settings")').click();
      await expect(page.locator('h1:has-text("Settings")')).toBeVisible({ timeout: 5000 });
      
      await goToApplyPage(page);
    }
  });

  test('empty state messages are user-friendly', async ({ page }) => {
    // Old assertion: expected "No setups found" but UI shows "No setup profiles found"
    // New contract: verify actual empty state message on Overview page
    await expect(page.locator('text=No setup profiles found')).toBeVisible();
    await expect(page.locator('text=Start by capturing your current computer setup')).toBeVisible();
    
    // Verify page shows check computer heading
    await goToVerifyPage(page);
    await expect(page.getByRole('heading', { name: 'Check computer' })).toBeVisible();
  });
});
