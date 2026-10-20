import { test, expect } from '@playwright/test';
import { installMockEngine } from './helpers/mock-engine';
import { openApp, previewTestProfile } from './helpers/ui-mode';

/**
 * Preview to Apply Transition Tests
 * Verifies the core flow: Select profile -> Auto-preview -> Apply changes -> Result
 */
test.describe('Preview to Apply Transition', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await installMockEngine(page, {
      applyCallCounter: '__APPLY_CALL_COUNT__',
      settleDelayMs: { apply: 50 },
      apps: [{ id: 'Notepad++.Notepad++', name: 'Notepad++', installs: true }],
    });
    await openApp(page, baseURL);
  });

  test('Selecting profile triggers exactly ONE preview call', async ({ page }) => {
    await previewTestProfile(page);

    const previewCount = await page.evaluate(() => (window as any).__APPLY_CALL_COUNT__);
    expect(previewCount).toBe(1);
    await expect(page.locator('[data-testid="setup-flow-apply"]')).toBeVisible();
  });

  test('Preview then Apply executes two separate calls', async ({ page }) => {
    await previewTestProfile(page);
    expect(await page.evaluate(() => (window as any).__APPLY_CALL_COUNT__)).toBe(1);

    await page.locator('[data-testid="setup-flow-apply"]').click();
    await expect(page.locator('text=Setup complete')).toBeVisible({ timeout: 10000 });
    expect(await page.evaluate(() => (window as any).__APPLY_CALL_COUNT__)).toBe(2);
  });

  test('Real-time progress shows during preview', async ({ page }) => {
    await previewTestProfile(page);
    await expect(page.locator('text=Notepad++')).toBeVisible();
  });

  test('Apply completes with correct final state', async ({ page }) => {
    await previewTestProfile(page);

    await page.locator('[data-testid="setup-flow-apply"]').click();
    await expect(page.locator('text=Setup complete')).toBeVisible({ timeout: 10000 });
  });
});
