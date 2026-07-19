import { test, expect } from '@playwright/test';
import { installTauriMock } from './helpers/tauri-mock';

test.describe('Save Profile Modal - Blocking Behavior', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await installTauriMock(page, {
      invoke: {
        list_manifest_files: () => ['C:\\test\\profiles\\profile.jsonc'],
        write_text_file: () => null,
        check_file_exists: () => false,
        rename_file: () => null,
        validate_profile: () => ({ valid: true, errors: [], summary: { name: 'test', version: 1, appCount: 0 } }),
      }
    });

    await page.addInitScript(() => {
      (window as any).__ENDSTATE_MOCK_ENGINE__ = {
        runEndstateStreaming: async (settings: any, command: string, args: string[], onEvent: Function) => {
          if (command === 'capabilities') {
            return { exitCode: 0, envelope: { success: true, data: { commands: ['capture', 'apply', 'verify', 'report'] } } };
          }
          if (command === 'report') {
            return { exitCode: 0, envelope: { success: true, data: { hasState: false } } };
          }
          return { exitCode: 0, envelope: { success: true, data: {} } };
        }
      };
    });
    
    await page.goto(baseURL || '/');
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => typeof (window as any).__endstate_e2e_openSaveProfileModal === 'function', { timeout: 10000 });
  });

  test('Modal blocks backdrop click', async ({ page }) => {
    // Open the Save profile modal using test hook
    await page.evaluate(() => {
      (window as any).__endstate_e2e_openSaveProfileModal({ suggestedName: 'Profile TEST' });
    });
    
    // Assert modal is visible
    await expect(page.locator('[data-testid="profile-name-modal"]')).toBeVisible({ timeout: 3000 });
    
    // Verify suggested name is populated
    const input = page.locator('[data-testid="profile-name-input"]');
    await expect(input).toHaveValue('Profile TEST');
    
    // Click backdrop - modal should stay open (blocking behavior)
    await page.evaluate(() => {
      const overlay = document.querySelector('[data-radix-dialog-overlay]');
      if (overlay) {
        (overlay as HTMLElement).click();
      }
    });
    await page.waitForTimeout(300);
    await expect(page.locator('[data-testid="profile-name-modal"]')).toBeVisible();
  });

  test('Escape key closes modal (triggers Cancel)', async ({ page }) => {
    // Open the Save profile modal using test hook
    await page.evaluate(() => {
      (window as any).__endstate_e2e_openSaveProfileModal({ suggestedName: 'Profile TEST' });
    });
    
    await expect(page.locator('[data-testid="profile-name-modal"]')).toBeVisible({ timeout: 3000 });
    
    // Press Escape - modal should close (Escape triggers Cancel behavior)
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await expect(page.locator('[data-testid="profile-name-modal"]')).not.toBeVisible();
  });

  test('Cancel button closes modal', async ({ page }) => {
    // Open the Save profile modal using test hook
    await page.evaluate(() => {
      (window as any).__endstate_e2e_openSaveProfileModal({ suggestedName: 'Profile TEST' });
    });
    
    await expect(page.locator('[data-testid="profile-name-modal"]')).toBeVisible({ timeout: 3000 });
    
    // Click Cancel - modal should close
    await page.click('[data-testid="profile-name-cancel"]');
    await page.waitForTimeout(300);
    await expect(page.locator('[data-testid="profile-name-modal"]')).not.toBeVisible();
  });
});
