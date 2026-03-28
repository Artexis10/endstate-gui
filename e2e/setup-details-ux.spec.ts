import { test, expect } from '@playwright/test';
import { installTauriMock } from './helpers/tauri-mock';

/**
 * E2E tests for Setup Details UX:
 * - Preview results show inline in SetupFlow
 * - Status labels are readable and not truncated
 * - Failure states render correctly
 */

test.describe('Setup Flow UX - Already Installed Results', () => {
  test.beforeEach(async ({ page, baseURL }) => {
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
            const ndjsonItems = [
              { event: 'item', id: 'App1', driver: 'winget', status: 'present', reason: 'already_installed', name: 'App1' },
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
                  counts: { installed: 0, alreadyInstalled: 1, failed: 0 },
                  items: ndjsonItems,
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

  test('Preview results show inline with readable status labels', async ({ page }) => {
    await page.locator('[data-testid="intent-setup"]').click();
    await expect(page.locator('[data-testid="setup-flow"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="profile-card-test-profile"]').click();
    await expect(page.locator('text=Preview complete')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=/already present/i').first()).toBeVisible();
    await expect(page.locator('text=App1').first()).toBeVisible();
  });
});

test.describe('Setup Flow UX - Would Install Results', () => {
  test.beforeEach(async ({ page, baseURL }) => {
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
            const ndjsonItems = [
              { event: 'item', id: 'TestApp.App', driver: 'winget', status: 'to_install', reason: 'would_install', name: 'TestApp' },
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
                  counts: { installed: 1, alreadyInstalled: 0, failed: 0 },
                  items: ndjsonItems,
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

  test('preview shows "to install" text without truncation', async ({ page }) => {
    await page.locator('[data-testid="intent-setup"]').click();
    await expect(page.locator('[data-testid="setup-flow"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="profile-card-test-profile"]').click();
    await expect(page.locator('text=Preview complete')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=/to install/i').first()).toBeVisible();
    // Should NOT show truncated status text
    await expect(page.locator('text=WOULD I')).not.toBeVisible();
    await expect(page.locator('[data-testid="setup-flow-apply"]')).toBeVisible();
  });
});

test.describe('Setup Flow UX - Failure Status', () => {
  test.beforeEach(async ({ page, baseURL }) => {
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
            const ndjsonItems = [
              { event: 'item', id: 'FailingApp.App', driver: 'winget', status: 'failed', reason: 'install_failed', name: 'Failing App', message: 'Package not found' },
            ];
            for (const item of ndjsonItems) {
              if (options?.onNdjsonEvent) options.onNdjsonEvent(item);
              if (onEvent) onEvent({ type: 'stdout', data: JSON.stringify(item) + '\n' });
            }
            return {
              exitCode: 1,
              envelope: {
                success: true,
                error: null,
                data: {
                  counts: { installed: 0, alreadyInstalled: 0, failed: 1 },
                  items: ndjsonItems,
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

  test('Preview shows completion even when items fail', async ({ page }) => {
    await page.locator('[data-testid="intent-setup"]').click();
    await expect(page.locator('[data-testid="setup-flow"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="profile-card-test-profile"]').click();
    // Should reach a terminal state without hanging
    await expect(
      page.locator('text=Preview complete').or(page.locator('text=/failed/i')).first()
    ).toBeVisible({ timeout: 10000 });
  });
});
