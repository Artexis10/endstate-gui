import { test, expect } from '@playwright/test';

test.describe('Save Profile Modal - Blocking Behavior', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    // Mock Tauri for basic operations
    await page.addInitScript(() => {
      (window as any).__TAURI__ = {
        core: {
          invoke: async (cmd: string, args?: any) => {
            if (cmd === 'ensure_dir') return null;
            if (cmd === 'read_dir') return [];
            if (cmd === 'list_manifest_files') {
              return ['C:\\test\\profiles\\profile.jsonc'];
            }
            if (cmd === 'get_default_profiles_directory') return 'C:\\test\\profiles';
            if (cmd === 'read_text_file') return '{"version": 1, "apps": []}';
            if (cmd === 'write_text_file') return null;
            if (cmd === 'check_file_exists') return false; // No collision
            if (cmd === 'rename_file') return null;
            if (cmd === 'validate_profile') {
              return { valid: true, errors: [], summary: { name: 'test', version: 1, appCount: 0 } };
            }
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
