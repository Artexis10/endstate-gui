import { test, expect } from '@playwright/test';

test.describe('Toast Modal Layering - Click-to-Dismiss with Modal Open', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    // Mock Tauri for basic operations
    await page.addInitScript(() => {
      (window as any).__TAURI__ = {
        core: {
          invoke: async (cmd: string, args?: any) => {
            if (cmd === 'ensure_dir') return null;
            if (cmd === 'read_dir') return [];
            if (cmd === 'list_manifest_files') {
              return [{ path: 'C:\\test\\profile.jsonc', name: 'profile.jsonc' }];
            }
            if (cmd === 'get_default_profiles_directory') return 'C:\\test\\profiles';
            if (cmd === 'read_text_file') return '{}';
            if (cmd === 'write_text_file') return null;
            if (cmd === 'check_file_exists') return true;
            return null;
          }
        }
      };
      
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
    
    // Wait for toast to appear, be fully mounted, and animation to complete
    const toast = page.locator('[data-sonner-toast]').first();
    await expect(toast).toBeVisible({ timeout: 2000 });
    // Wait for toast to be fully expanded (animation complete)
    await page.waitForTimeout(500);
    
    // Verify modal is still open (toast didn't interfere)
    await expect(page.locator('[data-testid="profile-name-modal"]')).toBeVisible();
    
    // Critical test: Click the toast while modal is open
    await toast.click();
    
    // Toast should disappear after click (allow time for Sonner animation)
    await expect(toast).not.toBeVisible({ timeout: 3000 });
    
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
    
    // Wait for both toasts to appear and animations to complete
    await page.waitForTimeout(600);
    const toasts = page.locator('[data-sonner-toast]');
    await expect(toasts).toHaveCount(2, { timeout: 2000 });
    
    // Click the first toast
    await toasts.first().click();
    
    // First toast should disappear (allow time for Sonner animation)
    await expect(toasts).toHaveCount(1, { timeout: 3000 });
    
    // Second toast should still be visible
    await expect(toasts.first()).toBeVisible();
    
    // Click the second toast
    await toasts.first().click();
    
    // All toasts should be gone (allow time for Sonner animation)
    await expect(toasts).toHaveCount(0, { timeout: 3000 });
    
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
