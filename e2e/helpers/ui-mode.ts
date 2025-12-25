import { Page, expect } from '@playwright/test';

/**
 * E2E Helpers for UI mode and navigation
 * 
 * The app stores UI mode in localStorage with key 'test:endstate-ui-mode'
 * (namespaced with 'test:' prefix when VITE_STORAGE_NS=test).
 * 
 * App always starts on Overview page regardless of UI mode.
 * Tests must navigate explicitly to other pages.
 */

/**
 * Seeds settings with a pre-selected profile.
 * Call this via addInitScript BEFORE page.goto().
 */
export function seedProfileSettings(page: Page, profileName = 'test-profile', dryRunEnabled = true): Promise<void> {
  return page.addInitScript(([name, dryRun]) => {
    const settings = {
      engineMode: 'path',
      engineScriptPath: '',
      customProfilesDirectory: '',
      lastSelectedProfile: name,
      lastSelectedProfilePath: `C:\\test\\profiles\\${name}.jsonc`,
      dryRunEnabled: dryRun,
    };
    localStorage.setItem('test:endstate-gui-settings', JSON.stringify(settings));
    localStorage.setItem('endstate-gui-settings', JSON.stringify(settings));
  }, [profileName, dryRunEnabled]);
}

/**
 * Force Advanced mode (sidebar navigation visible).
 * App starts on Overview; use goToApplyPage() to navigate.
 */
export function forceAdvancedMode(page: Page): Promise<void> {
  return page.addInitScript(() => {
    localStorage.setItem('test:endstate-ui-mode', 'advanced');
    localStorage.setItem('endstate-ui-mode', 'advanced');
  });
}

/**
 * Force Default mode (Overview screen, no sidebar).
 */
export function forceDefaultMode(page: Page): Promise<void> {
  return page.addInitScript(() => {
    localStorage.setItem('test:endstate-ui-mode', 'default');
    localStorage.setItem('endstate-ui-mode', 'default');
  });
}

/**
 * Navigate to Apply page ("Set up computer") from Overview in Advanced mode.
 * Clicks the sidebar nav button and asserts the page heading is visible.
 */
export async function goToApplyPage(page: Page): Promise<void> {
  await page.locator('nav >> button:has-text("Set up computer")').click();
  await expect(page.locator('h1:has-text("Set up computer")')).toBeVisible({ timeout: 5000 });
}

/**
 * Navigate to Capture page from Overview in Advanced mode.
 */
export async function goToCapturePage(page: Page): Promise<void> {
  await page.locator('nav >> button:has-text("Capture computer")').click();
  await expect(page.locator('h1:has-text("Capture computer")')).toBeVisible({ timeout: 5000 });
}

/**
 * Navigate to Verify page ("Check computer") from Overview in Advanced mode.
 */
export async function goToVerifyPage(page: Page): Promise<void> {
  await page.locator('nav >> button:has-text("Check computer")').click();
  await expect(page.locator('h1:has-text("Check computer")')).toBeVisible({ timeout: 5000 });
}
