import { test, expect } from './fixtures/tauri';

/**
 * Navigation Smoke Test (updated for IntentLanding + Flow architecture)
 *
 * The app now uses IntentLanding as the entry point with two flows:
 *   - "Save this computer" → SaveFlow (data-testid="save-flow")
 *   - "Set up this computer" → SetupFlow (data-testid="setup-flow")
 *
 * There is no sidebar Advanced mode navigation for flows.
 * Settings is accessible via a settings button on intent pages.
 * Verify/Check is a sub-action of setup, not a separate page.
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
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('landing page shows both intent cards', async ({ page }) => {
    // App starts on IntentLanding
    await expect(page.locator('h1:has-text("Endstate")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="intent-save"]')).toBeVisible();
    await expect(page.locator('[data-testid="intent-setup"]')).toBeVisible();

    // Verify descriptive text
    await expect(page.locator('text=What would you like to do?')).toBeVisible();
  });

  test('navigates to save flow and back', async ({ page }) => {
    await expect(page.locator('[data-testid="intent-save"]')).toBeVisible({ timeout: 10000 });

    // Enter save flow
    await page.locator('[data-testid="intent-save"]').click();
    await expect(page.locator('[data-testid="save-flow"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('h2:has-text("Save this computer")')).toBeVisible();

    // Go back
    await page.locator('[data-testid="save-flow-back"]').click();
    await expect(page.locator('h1:has-text("Endstate")')).toBeVisible({ timeout: 5000 });
  });

  test('navigates to setup flow and back', async ({ page }) => {
    await expect(page.locator('[data-testid="intent-setup"]')).toBeVisible({ timeout: 10000 });

    // Enter setup flow
    await page.locator('[data-testid="intent-setup"]').click();
    await expect(page.locator('[data-testid="setup-flow"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('h2:has-text("Set up this computer")')).toBeVisible();

    // Go back
    await page.locator('[data-testid="setup-flow-back"]').click();
    await expect(page.locator('h1:has-text("Endstate")')).toBeVisible({ timeout: 5000 });
  });

  test('navigates to settings and verifies heading', async ({ page }) => {
    await expect(page.locator('h1:has-text("Endstate")')).toBeVisible({ timeout: 10000 });

    // Settings button is in the topbar, which is hidden on the landing page.
    // Enter a flow first so the topbar appears.
    await page.locator('[data-testid="intent-save"]').click();
    await expect(page.locator('[data-testid="save-flow"]')).toBeVisible({ timeout: 5000 });

    // Now the settings button is visible in the header
    const settingsBtn = page.locator('button[title="Settings"]');
    await expect(settingsBtn).toBeVisible({ timeout: 3000 });
    await settingsBtn.click();
    await expect(page.locator('h1:has-text("Settings")')).toBeVisible({ timeout: 5000 });
  });

  test('each page has unique stable heading', async ({ page }) => {
    await expect(page.locator('h1:has-text("Endstate")')).toBeVisible({ timeout: 10000 });

    // Save flow has its own heading
    await page.locator('[data-testid="intent-save"]').click();
    await expect(page.locator('h2:has-text("Save this computer")')).toBeVisible({ timeout: 5000 });
    // Landing heading should not be visible when in a flow
    await expect(page.locator('h1:has-text("Endstate")')).not.toBeVisible();

    // Go back, then to setup
    await page.locator('[data-testid="save-flow-back"]').click();
    await expect(page.locator('h1:has-text("Endstate")')).toBeVisible({ timeout: 5000 });

    await page.locator('[data-testid="intent-setup"]').click();
    await expect(page.locator('h2:has-text("Set up this computer")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('h1:has-text("Endstate")')).not.toBeVisible();

    // Go back to landing, then enter a flow so the settings button is accessible
    await page.locator('[data-testid="setup-flow-back"]').click();
    await expect(page.locator('h1:has-text("Endstate")')).toBeVisible({ timeout: 5000 });

    // Enter save flow so topbar appears (settings button is there)
    await page.locator('[data-testid="intent-save"]').click();
    await expect(page.locator('[data-testid="save-flow"]')).toBeVisible({ timeout: 5000 });

    await page.locator('button[title="Settings"]').click();
    await expect(page.locator('h1:has-text("Settings")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('h2:has-text("Save this computer")')).not.toBeVisible();
    await expect(page.locator('h2:has-text("Set up this computer")')).not.toBeVisible();
  });

  test('navigation preserves app state (no crashes)', async ({ page }) => {
    await expect(page.locator('h1:has-text("Endstate")')).toBeVisible({ timeout: 10000 });

    // Navigate through all pages multiple times
    for (let i = 0; i < 2; i++) {
      // Save flow
      await page.locator('[data-testid="intent-save"]').click();
      await expect(page.locator('[data-testid="save-flow"]')).toBeVisible({ timeout: 5000 });
      await page.locator('[data-testid="save-flow-back"]').click();
      await expect(page.locator('h1:has-text("Endstate")')).toBeVisible({ timeout: 5000 });

      // Setup flow
      await page.locator('[data-testid="intent-setup"]').click();
      await expect(page.locator('[data-testid="setup-flow"]')).toBeVisible({ timeout: 5000 });
      await page.locator('[data-testid="setup-flow-back"]').click();
      await expect(page.locator('h1:has-text("Endstate")')).toBeVisible({ timeout: 5000 });

      // Settings - access from within a flow (topbar hidden on landing)
      await page.locator('[data-testid="intent-save"]').click();
      await expect(page.locator('[data-testid="save-flow"]')).toBeVisible({ timeout: 5000 });
      await page.locator('button[title="Settings"]').click();
      await expect(page.locator('h1:has-text("Settings")')).toBeVisible({ timeout: 5000 });

      // Navigate back from settings using Back button in topbar
      const backButton = page.locator('button[title="Back to Overview"], button:has-text("Back")').first();
      await expect(backButton).toBeVisible({ timeout: 3000 });
      await backButton.click();

      // Should return to save flow (previousPage was 'save')
      await expect(page.locator('[data-testid="save-flow"]')).toBeVisible({ timeout: 5000 });
      // Go back to landing for next iteration
      await page.locator('[data-testid="save-flow-back"]').click();
      await expect(page.locator('h1:has-text("Endstate")')).toBeVisible({ timeout: 5000 });
    }
  });

  test('setup flow shows empty state when no profiles', async ({ page }) => {
    await expect(page.locator('h1:has-text("Endstate")')).toBeVisible({ timeout: 10000 });

    // Enter setup flow - should show "No profiles found" since list_manifest_files returns []
    await page.locator('[data-testid="intent-setup"]').click();
    await expect(page.locator('[data-testid="setup-flow"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=No profiles found')).toBeVisible({ timeout: 5000 });
  });
});
