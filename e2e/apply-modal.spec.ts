import { test, expect } from '@playwright/test';
import { installTauriMock } from './helpers/tauri-mock';

/**
 * Setup Flow Tests -- verifies the intent-based setup flow:
 * Landing -> "Set up this computer" -> profile selection -> auto-preview -> results
 *
 * Key mock patterns:
 * - Use initialProfileFiles (serializable) for profile discovery
 * - Use envelope.data.counts for summary totals (source of truth)
 * - NDJSON events need event:'item' and EngineItemStatus values (to_install/present/installed/failed)
 */

test.describe('Setup Flow - All Already Installed', () => {
  test.beforeEach(async ({ page, baseURL }) => {
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
          if (command === 'apply') {
            const ndjsonItems = [
              { event: 'item', id: 'Discord.Discord', driver: 'winget', status: 'present', reason: 'already_installed', name: 'Discord' },
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

    await page.goto(baseURL || '/');
    await page.waitForLoadState('networkidle');
  });

  test('setup flow loads with profile list and back button', async ({ page }) => {
    await page.locator('[data-testid="intent-setup"]').click();
    await expect(page.locator('[data-testid="setup-flow"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="profile-card-test-profile"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="setup-flow-back"]')).toBeVisible();
  });

  test('selecting a profile auto-starts preview and shows results', async ({ page }) => {
    await page.locator('[data-testid="intent-setup"]').click();
    await expect(page.locator('[data-testid="setup-flow"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="profile-card-test-profile"]').click();
    await expect(page.locator('text=Preview complete')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=/already present/i').first()).toBeVisible();
  });

  test('shows "all apps already present" when nothing to install', async ({ page }) => {
    await page.locator('[data-testid="intent-setup"]').click();
    await expect(page.locator('[data-testid="setup-flow"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="profile-card-test-profile"]').click();
    await expect(page.locator('text=Preview complete')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=/already present/i').first()).toBeVisible();
    // No "Apply changes" button when nothing to install
    await expect(page.locator('[data-testid="setup-flow-apply"]')).not.toBeVisible();
  });
});

test.describe('Setup Flow - With Failures', () => {
  test.beforeEach(async ({ page, baseURL }) => {
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
          if (command === 'apply') {
            const isDryRun = args.includes('--dry-run');
            const ndjsonItems = [
              { event: 'item', id: 'Discord.Discord', driver: 'winget', status: isDryRun ? 'to_install' : 'installed', reason: isDryRun ? 'would_install' : 'installed', name: 'Discord' },
              { event: 'item', id: 'Google.Chrome', driver: 'winget', status: 'present', reason: 'already_installed', name: 'Chrome' },
              { event: 'item', id: 'BrokenApp.App', driver: 'winget', status: 'failed', reason: 'install_failed', name: 'Broken App' },
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

    await page.goto(baseURL || '/');
    await page.waitForLoadState('networkidle');
  });

  test('preview shows results even when some items would fail', async ({ page }) => {
    await page.locator('[data-testid="intent-setup"]').click();
    await expect(page.locator('[data-testid="setup-flow"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="profile-card-test-profile"]').click();
    await expect(page.locator('text=Preview complete')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=/to install/i').first()).toBeVisible();
  });
});

test.describe('Setup Flow - Pending Installs (Preview)', () => {
  test.beforeEach(async ({ page, baseURL }) => {
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
          if (command === 'apply') {
            const isDryRun = args.includes('--dry-run');
            const ndjsonItems = [
              { event: 'item', id: 'Notepad++.Notepad++', driver: 'winget', status: isDryRun ? 'to_install' : 'installed', reason: isDryRun ? 'would_install' : 'installed', name: 'Notepad++' },
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

    await page.goto(baseURL || '/');
    await page.waitForLoadState('networkidle');
  });

  test('shows Apply changes button when preview finds apps to install', async ({ page }) => {
    await page.locator('[data-testid="intent-setup"]').click();
    await expect(page.locator('[data-testid="setup-flow"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="profile-card-test-profile"]').click();
    await expect(page.locator('text=Preview complete')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=/to install/i').first()).toBeVisible();
    await expect(page.locator('[data-testid="setup-flow-apply"]')).toBeVisible();
  });
});
