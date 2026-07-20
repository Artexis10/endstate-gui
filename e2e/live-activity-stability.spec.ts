import { test, expect } from '@playwright/test';
import { installTauriMock } from './helpers/tauri-mock';

/**
 * E2E tests for live activity stability during setup flow.
 *
 * Selecting a profile auto-starts preview. Live activity events stream inline
 * within the SetupFlow component during both preview and apply phases.
 */

test.describe('Live Activity Stability', () => {
  test.beforeEach(async ({ page }) => {
    await installTauriMock(page, {
      initialProfileFiles: ['C:\\test\\profiles\\test-profile.jsonc'],
    });

    await page.addInitScript(() => {
      (window as any).__ENDSTATE_MOCK_ENGINE__ = {
        runEndstateStreaming: async (settings: any, command: string, args: string[], onEvent: Function, options?: any) => {
          if (command === 'capabilities') {
            return { exitCode: 0, envelope: { success: true, data: { commands: ['capture', 'apply', 'verify', 'report'] } }, ndjsonEvents: [] };
          }
          if (command === 'report') {
            return { exitCode: 0, envelope: { success: true, data: { hasState: false } }, ndjsonEvents: [] };
          }

          const isDryRun = args.includes('--dry-run');
          const ndjsonItems = [
            { event: 'item', id: 'app-1', driver: 'winget', status: isDryRun ? 'to_install' : 'installed', reason: isDryRun ? 'would_install' : 'installed', name: 'Test App 1' },
            { event: 'item', id: 'app-2', driver: 'winget', status: 'present', reason: 'already_installed', name: 'Test App 2' },
          ];

          for (const item of ndjsonItems) {
            if (options?.onNdjsonEvent) options.onNdjsonEvent(item);
            if (onEvent) onEvent({ type: 'stdout', data: JSON.stringify(item) + '\n' });
            await new Promise(r => setTimeout(r, 10));
          }

          return {
            exitCode: 0,
            envelope: {
              success: true,
              data: {
                dryRun: typeof isDryRun !== 'undefined' ? isDryRun : false,
                summary: {
                  total: ndjsonItems.length,
                  success: (typeof isDryRun !== 'undefined' && isDryRun) ? 0 : ndjsonItems.filter((i) => i.status === 'installed').length,
                  skipped: ndjsonItems.filter((i) => i.status === 'present').length,
                  failed: ndjsonItems.filter((i) => i.status === 'failed').length,
                },
                actions: ndjsonItems.map((i) => ({
                  id: i.id, ref: i.id, driver: i.driver, name: i.name,
                  status: i.status, reason: i.reason ?? '', message: '',
                  version: '', manual: null,
                })),
              }
            },
            ndjsonEvents: ndjsonItems,
          };
        }
      };
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('setup flow displays profile list on entry', async ({ page }) => {
    await page.locator('[data-testid="intent-setup"]').click();
    await expect(page.locator('[data-testid="setup-flow"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="profile-card-test-profile"]')).toBeVisible({ timeout: 10000 });
  });

  test('preview completes and shows results inline', async ({ page }) => {
    await page.locator('[data-testid="intent-setup"]').click();
    await expect(page.locator('[data-testid="setup-flow"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="profile-card-test-profile"]').click();
    await expect(page.locator('text=Preview complete')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=/to install|already present/i').first()).toBeVisible();
  });

  test('app names appear in preview results', async ({ page }) => {
    await page.locator('[data-testid="intent-setup"]').click();
    await expect(page.locator('[data-testid="setup-flow"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="profile-card-test-profile"]').click();
    await expect(page.locator('text=Preview complete')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Test App 1')).toBeVisible();
    await expect(page.locator('text=Test App 2')).toBeVisible();
  });

  test('Apply changes button appears when apps need installing', async ({ page }) => {
    await page.locator('[data-testid="intent-setup"]').click();
    await expect(page.locator('[data-testid="setup-flow"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="profile-card-test-profile"]').click();
    await expect(page.locator('text=Preview complete')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=/to install/i').first()).toBeVisible();
    await expect(page.locator('[data-testid="setup-flow-apply"]')).toBeVisible();
  });

  test('preview renders correctly without DOM issues', async ({ page }) => {
    await page.locator('[data-testid="intent-setup"]').click();
    await expect(page.locator('[data-testid="setup-flow"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="profile-card-test-profile"]').click();
    await expect(page.locator('text=Preview complete')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Test App 1')).toBeVisible();
    await expect(page.locator('text=Test App 2')).toBeVisible();
  });
});

test.describe('Double-Run Prevention', () => {
  test.beforeEach(async ({ page }) => {
    await installTauriMock(page, {
      initialProfileFiles: ['C:\\test\\profiles\\test-profile.jsonc'],
    });

    await page.addInitScript(() => {
      (window as any).__test_runCount = 0;

      (window as any).__ENDSTATE_MOCK_ENGINE__ = {
        runEndstateStreaming: async (settings: any, command: string, args: string[], onEvent: Function, options?: any) => {
          if (command === 'capabilities') {
            return { exitCode: 0, envelope: { success: true, data: { commands: ['capture', 'apply', 'verify', 'report'] } }, ndjsonEvents: [] };
          }
          if (command === 'report') {
            return { exitCode: 0, envelope: { success: true, data: { hasState: false } }, ndjsonEvents: [] };
          }

          if (command === 'apply') {
            (window as any).__test_runCount++;
          }

          const isDryRun = args.includes('--dry-run');
          const ndjsonItems = [
            { event: 'item', id: 'app-1', driver: 'winget', status: isDryRun ? 'to_install' : 'installed', reason: isDryRun ? 'would_install' : 'installed', name: 'Test App 1' },
            { event: 'item', id: 'app-2', driver: 'winget', status: 'present', reason: 'already_installed', name: 'Test App 2' },
          ];

          for (const item of ndjsonItems) {
            if (options?.onNdjsonEvent) options.onNdjsonEvent(item);
            if (onEvent) onEvent({ type: 'stdout', data: JSON.stringify(item) + '\n' });
            await new Promise(r => setTimeout(r, 10));
          }

          return {
            exitCode: 0,
            envelope: {
              success: true,
              data: {
                dryRun: typeof isDryRun !== 'undefined' ? isDryRun : false,
                summary: {
                  total: ndjsonItems.length,
                  success: (typeof isDryRun !== 'undefined' && isDryRun) ? 0 : ndjsonItems.filter((i) => i.status === 'installed').length,
                  skipped: ndjsonItems.filter((i) => i.status === 'present').length,
                  failed: ndjsonItems.filter((i) => i.status === 'failed').length,
                },
                actions: ndjsonItems.map((i) => ({
                  id: i.id, ref: i.id, driver: i.driver, name: i.name,
                  status: i.status, reason: i.reason ?? '', message: '',
                  version: '', manual: null,
                })),
              }
            },
            ndjsonEvents: ndjsonItems,
          };
        }
      };
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('profile selection triggers exactly one preview run', async ({ page }) => {
    await page.locator('[data-testid="intent-setup"]').click();
    await expect(page.locator('[data-testid="setup-flow"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="profile-card-test-profile"]').click();
    await expect(page.locator('text=Preview complete')).toBeVisible({ timeout: 10000 });

    const runCount = await page.evaluate(() => (window as any).__test_runCount);
    expect(runCount).toBe(1);
  });

  test('apply completes after a single click', async ({ page }) => {
    await page.locator('[data-testid="intent-setup"]').click();
    await expect(page.locator('[data-testid="setup-flow"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="profile-card-test-profile"]').click();
    await expect(page.locator('text=Preview complete')).toBeVisible({ timeout: 10000 });

    await page.evaluate(() => { (window as any).__test_runCount = 0; });

    // Single click on Apply changes
    await page.locator('[data-testid="setup-flow-apply"]').click();
    await expect(page.locator('text=Setup complete')).toBeVisible({ timeout: 10000 });

    // Verify exactly one apply run was executed
    const runCount = await page.evaluate(() => (window as any).__test_runCount);
    expect(runCount).toBe(1);
  });
});
