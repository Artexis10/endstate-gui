import { test, expect } from '@playwright/test';
import { installMockEngine, type MockEngineOptions } from './helpers/mock-engine';
import { openApp, previewTestProfile } from './helpers/ui-mode';

/**
 * E2E tests for live activity stability during setup flow.
 *
 * Selecting a profile auto-starts preview. Live activity events stream inline
 * within the SetupFlow component during both preview and apply phases.
 */

// Every engine command streams both apps, 10ms apart.
const STREAMING_ENGINE: MockEngineOptions = {
  streamOn: 'every-command',
  itemDelayMs: 10,
  apps: [
    { id: 'app-1', name: 'Test App 1', installs: true },
    { id: 'app-2', name: 'Test App 2', status: 'present', reason: 'already_installed' },
  ],
};

test.describe('Live Activity Stability', () => {
  test.beforeEach(async ({ page }) => {
    await installMockEngine(page, STREAMING_ENGINE);
    await openApp(page);
  });

  test('setup flow displays profile list on entry', async ({ page }) => {
    await page.locator('[data-testid="intent-setup"]').click();
    await expect(page.locator('[data-testid="setup-flow"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="profile-card-test-profile"]')).toBeVisible({ timeout: 10000 });
  });

  test('preview completes and shows results inline', async ({ page }) => {
    await previewTestProfile(page);
    await expect(page.locator('text=Preview complete')).toBeVisible();
    await expect(page.locator('text=/to install|already present/i').first()).toBeVisible();
  });

  test('app names appear in preview results', async ({ page }) => {
    await previewTestProfile(page);
    await expect(page.locator('text=Test App 1')).toBeVisible();
    await expect(page.locator('text=Test App 2')).toBeVisible();
  });

  test('Apply changes button appears when apps need installing', async ({ page }) => {
    await previewTestProfile(page);
    await expect(page.locator('text=/to install/i').first()).toBeVisible();
    await expect(page.locator('[data-testid="setup-flow-apply"]')).toBeVisible();
  });

  test('preview renders correctly without DOM issues', async ({ page }) => {
    await previewTestProfile(page);
    await expect(page.locator('text=Test App 1')).toBeVisible();
    await expect(page.locator('text=Test App 2')).toBeVisible();
  });
});

test.describe('Double-Run Prevention', () => {
  test.beforeEach(async ({ page }) => {
    await installMockEngine(page, { ...STREAMING_ENGINE, applyCallCounter: '__test_runCount' });
    await openApp(page);
  });

  test('profile selection triggers exactly one preview run', async ({ page }) => {
    await previewTestProfile(page);

    const runCount = await page.evaluate(() => (window as any).__test_runCount);
    expect(runCount).toBe(1);
  });

  test('apply completes after a single click', async ({ page }) => {
    await previewTestProfile(page);

    await page.evaluate(() => { (window as any).__test_runCount = 0; });

    // Single click on Apply changes
    await page.locator('[data-testid="setup-flow-apply"]').click();
    await expect(page.locator('text=Setup complete')).toBeVisible({ timeout: 10000 });

    // Verify exactly one apply run was executed
    const runCount = await page.evaluate(() => (window as any).__test_runCount);
    expect(runCount).toBe(1);
  });
});
