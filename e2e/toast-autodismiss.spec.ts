import { test, expect } from '@playwright/test';
import { installTauriMock } from './helpers/tauri-mock';

test.describe('Toast Auto-Dismiss', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await installTauriMock(page, {
      invoke: {
        list_manifest_files: [{ path: 'C:\\test\\profile.jsonc', name: 'profile.jsonc' }],
        check_file_exists: true,
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
  });

  test('Success toast auto-dismisses within expected duration', async ({ page }) => {
    // Trigger a success toast using E2E test hook
    await page.evaluate(() => {
      (window as any).__endstate_e2e_showToast('Success message', 'success');
    });
    
    // Wait for toast to appear
    const toast = page.locator('[data-sonner-toast]').first();
    await expect(toast).toBeVisible({ timeout: 2000 });
    
    // Verify toast content
    await expect(toast).toContainText('Success message');
    
    // Wait for toast to auto-dismiss (success = 3000ms, add buffer for animation)
    await expect(toast).not.toBeVisible({ timeout: 6000 });
  });

  test('Info toast auto-dismisses within expected duration', async ({ page }) => {
    // Trigger an info toast
    await page.evaluate(() => {
      (window as any).__endstate_e2e_showToast('Info message', 'info');
    });
    
    const toast = page.locator('[data-sonner-toast]').first();
    await expect(toast).toBeVisible({ timeout: 2000 });
    await expect(toast).toContainText('Info message');
    
    // Info toast should also dismiss around 3000ms
    await expect(toast).not.toBeVisible({ timeout: 6000 });
  });

  test('Warning toast auto-dismisses within expected duration', async ({ page }) => {
    // Trigger a warning toast
    await page.evaluate(() => {
      (window as any).__endstate_e2e_showToast('Warning message', 'warning');
    });
    
    const toast = page.locator('[data-sonner-toast]').first();
    await expect(toast).toBeVisible({ timeout: 2000 });
    await expect(toast).toContainText('Warning message');
    
    // Warning toast should dismiss around 5000ms
    await expect(toast).not.toBeVisible({ timeout: 8000 });
  });

  test('Error toast auto-dismisses within expected duration', async ({ page }) => {
    // Trigger an error toast
    await page.evaluate(() => {
      (window as any).__endstate_e2e_showToast('Error message', 'error');
    });
    
    const toast = page.locator('[data-sonner-toast]').first();
    await expect(toast).toBeVisible({ timeout: 2000 });
    await expect(toast).toContainText('Error message');
    
    // Error toast should dismiss around 5000ms
    await expect(toast).not.toBeVisible({ timeout: 8000 });
  });

  test('Multiple toasts auto-dismiss independently', async ({ page }) => {
    // Trigger multiple toasts with different types
    await page.evaluate(() => {
      (window as any).__endstate_e2e_showToast('First toast', 'success');
      setTimeout(() => {
        (window as any).__endstate_e2e_showToast('Second toast', 'warning');
      }, 500);
    });
    
    // Wait for both toasts to appear
    const toasts = page.locator('[data-sonner-toast]');
    await expect(toasts).toHaveCount(2, { timeout: 3000 });
    
    // First toast (success, 3s) should disappear before second (warning, 5s)
    await expect(toasts).toHaveCount(1, { timeout: 6000 });
    
    // Second toast should still be visible briefly
    await expect(toasts.first()).toBeVisible();
    
    // Second toast should eventually disappear
    await expect(toasts).toHaveCount(0, { timeout: 5000 });
  });

  test('Toast remains dismissible via swipe/click', async ({ page }) => {
    // Trigger a toast
    await page.evaluate(() => {
      (window as any).__endstate_e2e_showToast('Dismissible toast', 'info');
    });
    
    const toast = page.locator('[data-sonner-toast]').first();
    await expect(toast).toBeVisible({ timeout: 2000 });
    
    // Verify toast has dismissible styling (cursor-default, select-none, touch-pan-y)
    const toastClasses = await toast.getAttribute('class');
    expect(toastClasses).toContain('cursor-default');
    expect(toastClasses).toContain('select-none');
    expect(toastClasses).toContain('touch-pan-y');
    
    // Toast should still auto-dismiss even with dismissible enabled
    await expect(toast).not.toBeVisible({ timeout: 6000 });
  });
});
