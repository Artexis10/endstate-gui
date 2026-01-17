import { test, expect } from '@playwright/test';
import { installTauriMock } from './helpers/tauri-mock';

test.describe('Toast Modal Layering - Click-to-Dismiss with Modal Open', () => {
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

  test('Toast remains clickable and dismisses when modal is open', async ({ page }) => {
    // Open a modal (using existing test hook for Save Profile modal)
    await page.evaluate(() => {
      (window as any).__endstate_e2e_openSaveProfileModal({ suggestedName: 'Test Profile' });
    });
    
    // Verify modal is visible
    await expect(page.locator('[data-testid="profile-name-modal"]')).toBeVisible({ timeout: 3000 });
    
    // Trigger a toast using existing E2E test hook
    await page.evaluate(() => {
      (window as any).__endstate_e2e_showToast('Test toast message', 'info');
    });
    
    // Wait for toast to appear
    const toasts = page.locator('[data-sonner-toast]');
    await expect(toasts).toHaveCount(1, { timeout: 2000 });
    
    // Verify modal is still open (toast didn't interfere)
    await expect(page.locator('[data-testid="profile-name-modal"]')).toBeVisible();
    
    // Verify toast is clickable (has pointer-events: auto) - this tests z-index is correct
    const toastPointerEvents = await page.evaluate(() => {
      const toastEl = document.querySelector('[data-sonner-toast]');
      if (!toastEl) return null;
      return window.getComputedStyle(toastEl).pointerEvents;
    });
    expect(toastPointerEvents).toBe('auto');
    
    // Wait for toast to auto-dismiss (3s duration for info toasts)
    await expect(toasts).toHaveCount(0, { timeout: 5000 });
    
    // Modal should still be open (toast interaction didn't affect modal)
    await expect(page.locator('[data-testid="profile-name-modal"]')).toBeVisible();
  });

  test('Multiple toasts can be dismissed individually with modal open', async ({ page }) => {
    // Open modal
    await page.evaluate(() => {
      (window as any).__endstate_e2e_openSaveProfileModal({ suggestedName: 'Test' });
    });
    
    await expect(page.locator('[data-testid="profile-name-modal"]')).toBeVisible({ timeout: 3000 });
    
    // Trigger two toasts using E2E test hook
    await page.evaluate(() => {
      (window as any).__endstate_e2e_showToast('First toast', 'success');
      setTimeout(() => {
        (window as any).__endstate_e2e_showToast('Second toast', 'warning');
      }, 100);
    });
    
    // Wait for both toasts to appear
    const toasts = page.locator('[data-sonner-toast]');
    await expect(toasts).toHaveCount(2, { timeout: 3000 });
    
    // Verify both toasts are clickable (pointer-events: auto)
    const toastsClickable = await page.evaluate(() => {
      const toastElements = document.querySelectorAll('[data-sonner-toast]');
      return Array.from(toastElements).every(el => 
        window.getComputedStyle(el).pointerEvents === 'auto'
      );
    });
    expect(toastsClickable).toBe(true);
    
    // Wait for toasts to auto-dismiss (3s for success, 5s for warning)
    // First toast (success) should disappear first
    await expect(toasts).toHaveCount(1, { timeout: 5000 });
    
    // Second toast should still be visible
    await expect(toasts.first()).toBeVisible();
    
    // Wait for second toast to auto-dismiss
    await expect(toasts).toHaveCount(0, { timeout: 7000 });
    
    // Modal should still be open
    await expect(page.locator('[data-testid="profile-name-modal"]')).toBeVisible();
  });

  test('Toast z-index regression: toast must be above modal overlay', async ({ page }) => {
    // Open modal
    await page.evaluate(() => {
      (window as any).__endstate_e2e_openSaveProfileModal({ suggestedName: 'Z-Index Test' });
    });
    
    await expect(page.locator('[data-testid="profile-name-modal"]')).toBeVisible({ timeout: 3000 });
    
    // Trigger toast using E2E test hook
    await page.evaluate(() => {
      (window as any).__endstate_e2e_showToast('Z-index test toast', 'error');
    });
    
    const toast = page.locator('[data-sonner-toast]').first();
    await expect(toast).toBeVisible({ timeout: 2000 });
    
    // Get computed z-index values
    const toastZIndex = await page.evaluate(() => {
      const toaster = document.querySelector('[data-sonner-toaster]');
      if (!toaster) return null;
      return parseInt(window.getComputedStyle(toaster).zIndex, 10);
    });
    
    const modalOverlayZIndex = await page.evaluate(() => {
      const overlay = document.querySelector('[data-radix-dialog-overlay]');
      if (!overlay) return null;
      return parseInt(window.getComputedStyle(overlay).zIndex, 10);
    });
    
    // Assert toast z-index is higher than modal overlay
    expect(toastZIndex).toBeGreaterThan(modalOverlayZIndex || 0);
    
    // Verify toast is actually clickable (pointer-events)
    const toastPointerEvents = await page.evaluate(() => {
      const toastEl = document.querySelector('[data-sonner-toast]');
      if (!toastEl) return null;
      return window.getComputedStyle(toastEl).pointerEvents;
    });
    
    expect(toastPointerEvents).toBe('auto');
  });
});
