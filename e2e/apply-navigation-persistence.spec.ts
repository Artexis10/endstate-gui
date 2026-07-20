import { test, expect } from '@playwright/test';
import { installTauriMock } from './helpers/tauri-mock';

/**
 * E2E Test: Apply -> Navigate Away -> Back -> UI Persistence
 *
 * Tests that setup flow state persists across the component lifecycle.
 * The SetupFlow is always-mounted (hidden via CSS display:none when not active),
 * so internal state should survive navigating to settings/reports and back.
 */

/**
 * `dryRunEnabled` defaults to true in settings.ts. Both describes below
 * exercise the real-apply path (UI assertions around "Installing…" and
 * the partial-failure surface), so they must force the setting to false
 * — otherwise the GUI passes `--dry-run` (per the App.tsx fix) and the
 * mocks take their dry-run branch, which short-circuits these tests.
 */
async function seedDryRunOff(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const KEY = 'test:endstate-gui-settings';
    const existing = localStorage.getItem(KEY);
    const settings = existing ? JSON.parse(existing) : {};
    settings.dryRunEnabled = false;
    localStorage.setItem(KEY, JSON.stringify(settings));
  });
}

test.describe('Apply Navigation Persistence', () => {
  test.beforeEach(async ({ page }) => {
    await installTauriMock(page, {
      initialProfileFiles: ['C:\\test\\profiles\\test-profile.jsonc'],
    });

    await seedDryRunOff(page);

    await page.addInitScript(() => {
      (window as any).__APPLY_STARTED__ = false;
      (window as any).__APPLY_COMPLETE__ = false;
      (window as any).__APPLY_RESOLVER__ = null;

      (window as any).__ENDSTATE_MOCK_ENGINE__ = {
        runEndstateStreaming: async (settings: any, command: string, args: string[], onEvent: Function, options?: any) => {
          if (command === 'capabilities') {
            return { exitCode: 0, envelope: { success: true, data: { commands: ['capture', 'apply', 'report'] } } };
          }
          if (command === 'report') {
            return { exitCode: 0, envelope: { success: true, data: { hasState: false } } };
          }
          if (command === 'apply') {
            const isDryRun = args.includes('--dry-run');

            if (isDryRun) {
              // Preview: return immediately with to_install results
              const ndjsonItems = [
                { event: 'item', id: 'Discord.Discord', driver: 'winget', status: 'to_install', reason: 'would_install', name: 'Discord' },
                { event: 'item', id: 'Google.Chrome', driver: 'winget', status: 'present', reason: 'already_installed', name: 'Chrome' },
              ];
              for (const item of ndjsonItems) {
                if (options?.onNdjsonEvent) options.onNdjsonEvent(item);
                if (onEvent) onEvent({ type: 'stdout', data: JSON.stringify(item) + '\n' });
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

            // Non-dry-run: wait for test to signal completion
            (window as any).__APPLY_STARTED__ = true;
            onEvent({ type: 'stdout', data: '[INSTALL] Discord.Discord\n' });

            await new Promise<void>((resolve) => {
              (window as any).__APPLY_RESOLVER__ = resolve;
              setTimeout(() => {
                if (!(window as any).__APPLY_COMPLETE__) {
                  (window as any).__APPLY_COMPLETE__ = true;
                  resolve();
                }
              }, 10000);
            });

            const ndjsonItems = [
              { event: 'item', id: 'Discord.Discord', driver: 'winget', status: 'installed', reason: 'installed', name: 'Discord' },
              { event: 'item', id: 'Google.Chrome', driver: 'winget', status: 'present', reason: 'already_installed', name: 'Chrome' },
            ];
            for (const item of ndjsonItems) {
              if (options?.onNdjsonEvent) options.onNdjsonEvent(item);
              if (onEvent) onEvent({ type: 'stdout', data: JSON.stringify(item) + '\n' });
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
          return { exitCode: 0, envelope: { success: true, data: {} } };
        }
      };
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Setup flow completes preview and shows apply button', async ({ page }) => {
    await page.locator('[data-testid="intent-setup"]').click();
    await expect(page.locator('[data-testid="setup-flow"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="profile-card-test-profile"]').click();
    await expect(page.locator('text=Preview complete')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=/to install/i').first()).toBeVisible();
    await expect(page.locator('[data-testid="setup-flow-apply"]')).toBeVisible();
  });

  test('Apply runs and completes with success', async ({ page }) => {
    await page.locator('[data-testid="intent-setup"]').click();
    await expect(page.locator('[data-testid="setup-flow"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="profile-card-test-profile"]').click();
    await expect(page.locator('text=Preview complete')).toBeVisible({ timeout: 10000 });

    await page.locator('[data-testid="setup-flow-apply"]').click();

    await expect.poll(async () => {
      return await page.evaluate(() => (window as any).__APPLY_STARTED__);
    }, { timeout: 5000 }).toBe(true);

    await page.evaluate(() => {
      (window as any).__APPLY_COMPLETE__ = true;
      if ((window as any).__APPLY_RESOLVER__) {
        (window as any).__APPLY_RESOLVER__();
      }
    });

    await expect(page.locator('text=Setup complete')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Apply Completion States', () => {
  test('shows success completion UI after successful apply', async ({ page }) => {
    await installTauriMock(page, {
      initialProfileFiles: ['C:\\test\\profiles\\test-profile.jsonc'],
    });

    await page.addInitScript(() => {
      (window as any).__ENDSTATE_MOCK_ENGINE__ = {
        runEndstateStreaming: async (settings: any, command: string, args: string[], onEvent: Function, options?: any) => {
          if (command === 'capabilities') {
            return { exitCode: 0, envelope: { success: true, data: { commands: ['capture', 'apply', 'report'] } } };
          }
          if (command === 'report') {
            return { exitCode: 0, envelope: { success: true, data: { hasState: false } } };
          }
          if (command === 'apply') {
            const isDryRun = args.includes('--dry-run');
            const ndjsonItems = [
              { event: 'item', id: 'Discord.Discord', driver: 'winget', status: isDryRun ? 'to_install' : 'installed', reason: isDryRun ? 'would_install' : 'installed', name: 'Discord' },
            ];
            for (const item of ndjsonItems) {
              if (options?.onNdjsonEvent) options.onNdjsonEvent(item);
              if (onEvent) onEvent({ type: 'stdout', data: JSON.stringify(item) + '\n' });
            }
            await new Promise(r => setTimeout(r, 100));
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
          return { exitCode: 0, envelope: { success: true, data: {} } };
        }
      };
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.locator('[data-testid="intent-setup"]').click();
    await expect(page.locator('[data-testid="setup-flow"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="profile-card-test-profile"]').click();
    await expect(page.locator('text=Preview complete')).toBeVisible({ timeout: 10000 });

    await page.locator('[data-testid="setup-flow-apply"]').click();
    await expect(page.locator('text=Setup complete')).toBeVisible({ timeout: 10000 });
  });

  test('shows partial failure UI when some apps fail', async ({ page }) => {
    await installTauriMock(page, {
      initialProfileFiles: ['C:\\test\\profiles\\test-profile.jsonc'],
    });

    // Force real-apply path; this test asserts on partial-failure surface.
    await seedDryRunOff(page);

    await page.addInitScript(() => {
      (window as any).__ENDSTATE_MOCK_ENGINE__ = {
        runEndstateStreaming: async (settings: any, command: string, args: string[], onEvent: Function, options?: any) => {
          if (command === 'capabilities') {
            return { exitCode: 0, envelope: { success: true, data: { commands: ['capture', 'apply', 'report'] } } };
          }
          if (command === 'report') {
            return { exitCode: 0, envelope: { success: true, data: { hasState: false } } };
          }
          if (command === 'apply') {
            const isDryRun = args.includes('--dry-run');
            const ndjsonItems = [
              { event: 'item', id: 'Discord.Discord', driver: 'winget', status: isDryRun ? 'to_install' : 'installed', reason: isDryRun ? 'would_install' : 'installed', name: 'Discord' },
              { event: 'item', id: 'BrokenApp.App', driver: 'winget', status: 'failed', reason: 'install_failed', name: 'Broken App' },
            ];
            for (const item of ndjsonItems) {
              if (options?.onNdjsonEvent) options.onNdjsonEvent(item);
              if (onEvent) onEvent({ type: 'stdout', data: JSON.stringify(item) + '\n' });
            }
            await new Promise(r => setTimeout(r, 100));
            return {
              exitCode: isDryRun ? 0 : 1,
              envelope: {
                success: isDryRun,
                error: null,
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
          return { exitCode: 0, envelope: { success: true, data: {} } };
        }
      };
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.locator('[data-testid="intent-setup"]').click();
    await expect(page.locator('[data-testid="setup-flow"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="profile-card-test-profile"]').click();
    await expect(page.locator('text=Preview complete')).toBeVisible({ timeout: 10000 });

    await page.locator('[data-testid="setup-flow-apply"]').click();
    await expect(page.locator('text=Setup completed with errors')).toBeVisible({ timeout: 10000 });
  });
});
