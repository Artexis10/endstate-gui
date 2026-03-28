import { test, expect } from '@playwright/test';
import { installTauriMock } from './helpers/tauri-mock';

/**
 * Preview to Apply Transition Tests
 * Verifies the core flow: Select profile -> Auto-preview -> Apply changes -> Result
 */
test.describe('Preview to Apply Transition', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await installTauriMock(page, {
      initialProfileFiles: ['C:\\test\\profiles\\test-profile.jsonc'],
    });

    await page.addInitScript(() => {
      (window as any).__APPLY_CALL_COUNT__ = 0;

      (window as any).__ENDSTATE_MOCK_ENGINE__ = {
        runEndstateStreaming: async (settings: any, command: string, args: string[], onEvent: Function, options?: any) => {
          if (command === 'capabilities') {
            return { exitCode: 0, envelope: { success: true, data: { commands: ['capture', 'apply', 'verify', 'report'] } }, ndjsonEvents: [] };
          }
          if (command === 'report') {
            return { exitCode: 0, envelope: { success: true, data: { hasState: false } }, ndjsonEvents: [] };
          }
          if (command === 'apply') {
            (window as any).__APPLY_CALL_COUNT__++;
            const isDryRun = args.includes('--dry-run');

            const ndjsonItems = [
              { event: 'item', id: 'Notepad++.Notepad++', driver: 'winget', status: isDryRun ? 'to_install' : 'installed', reason: isDryRun ? 'would_install' : 'installed', name: 'Notepad++' },
            ];
            for (const item of ndjsonItems) {
              if (options?.onNdjsonEvent) options.onNdjsonEvent(item);
              if (onEvent) onEvent({ type: 'stdout', data: JSON.stringify(item) + '\n' });
            }

            if (!isDryRun) {
              await new Promise(r => setTimeout(r, 50));
            }

            return {
              exitCode: 0,
              envelope: {
                success: true,
                data: {
                  counts: { installed: 1, alreadyInstalled: 0, failed: 0 },
                  items: ndjsonItems,
                }
              },
              ndjsonEvents: ndjsonItems,
            };
          }
          return { exitCode: 0, envelope: { success: true, data: {} }, ndjsonEvents: [] };
        }
      };
    });

    await page.goto(baseURL || '/');
    await page.waitForLoadState('networkidle');
  });

  test('Selecting profile triggers exactly ONE preview call', async ({ page }) => {
    await page.locator('[data-testid="intent-setup"]').click();
    await expect(page.locator('[data-testid="setup-flow"]')).toBeVisible({ timeout: 5000 });

    await page.locator('[data-testid="profile-card-test-profile"]').click();
    await expect(page.locator('text=Preview complete')).toBeVisible({ timeout: 10000 });

    const previewCount = await page.evaluate(() => (window as any).__APPLY_CALL_COUNT__);
    expect(previewCount).toBe(1);
    await expect(page.locator('[data-testid="setup-flow-apply"]')).toBeVisible();
  });

  test('Preview then Apply executes two separate calls', async ({ page }) => {
    await page.locator('[data-testid="intent-setup"]').click();
    await expect(page.locator('[data-testid="setup-flow"]')).toBeVisible({ timeout: 5000 });

    await page.locator('[data-testid="profile-card-test-profile"]').click();
    await expect(page.locator('text=Preview complete')).toBeVisible({ timeout: 10000 });
    expect(await page.evaluate(() => (window as any).__APPLY_CALL_COUNT__)).toBe(1);

    await page.locator('[data-testid="setup-flow-apply"]').click();
    await expect(page.locator('text=Setup complete')).toBeVisible({ timeout: 10000 });
    expect(await page.evaluate(() => (window as any).__APPLY_CALL_COUNT__)).toBe(2);
  });

  test('Real-time progress shows during preview', async ({ page }) => {
    await page.locator('[data-testid="intent-setup"]').click();
    await expect(page.locator('[data-testid="setup-flow"]')).toBeVisible({ timeout: 5000 });

    await page.locator('[data-testid="profile-card-test-profile"]').click();
    await expect(page.locator('text=Preview complete')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Notepad++')).toBeVisible();
  });

  test('Apply completes with correct final state', async ({ page }) => {
    await page.locator('[data-testid="intent-setup"]').click();
    await expect(page.locator('[data-testid="setup-flow"]')).toBeVisible({ timeout: 5000 });

    await page.locator('[data-testid="profile-card-test-profile"]').click();
    await expect(page.locator('text=Preview complete')).toBeVisible({ timeout: 10000 });

    await page.locator('[data-testid="setup-flow-apply"]').click();
    await expect(page.locator('text=Setup complete')).toBeVisible({ timeout: 10000 });
  });
});
