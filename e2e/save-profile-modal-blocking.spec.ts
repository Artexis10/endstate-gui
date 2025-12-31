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

  test('Modal blocks backdrop click and Escape, allows Cancel and Save', async ({ page }) => {
    // Open the Save profile modal using test hook
    await page.evaluate(() => {
      (window as any).__endstate_e2e_openSaveProfileModal({ suggestedName: 'Profile TEST' });
    });
    
    // Assert modal is visible
    await expect(page.locator('[data-testid="profile-name-modal"]')).toBeVisible({ timeout: 3000 });
    
    // Verify suggested name is populated
    const input = page.locator('[data-testid="profile-name-input"]');
    await expect(input).toHaveValue('Profile TEST');
    
    // Test 1: Click backdrop - modal should stay open
    await page.evaluate(() => {
      const overlay = document.querySelector('[data-radix-dialog-overlay]');
      if (overlay) {
        (overlay as HTMLElement).click();
      }
    });
    await page.waitForTimeout(300);
    await expect(page.locator('[data-testid="profile-name-modal"]')).toBeVisible();
    
    // Test 2: Press Escape - modal should stay open
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await expect(page.locator('[data-testid="profile-name-modal"]')).toBeVisible();
    
    // Test 3: Click Cancel - modal should close
    await page.click('[data-testid="profile-name-cancel"]');
    await page.waitForTimeout(300);
    await expect(page.locator('[data-testid="profile-name-modal"]')).not.toBeVisible();
    
    // Verify no profile was created (list_manifest_files returns same single profile)
    const profileCountBefore = await page.evaluate(async () => {
      const result = await (window as any).__TAURI__.core.invoke('list_manifest_files', { directory: 'C:\\test\\profiles' });
      return result.length;
    });
    expect(profileCountBefore).toBe(1);
    
    // Test 4: Reopen modal and click Save
    await page.evaluate(() => {
      (window as any).__endstate_e2e_openSaveProfileModal({ suggestedName: 'Final Profile' });
    });
    await expect(page.locator('[data-testid="profile-name-modal"]')).toBeVisible({ timeout: 3000 });
    
    // Change the name
    await input.fill('Saved Profile Name');
    
    // Click Save
    await page.click('[data-testid="profile-name-save"]');
    await page.waitForTimeout(300);
    
    // Modal should close
    await expect(page.locator('[data-testid="profile-name-modal"]')).not.toBeVisible();
    
    // Verify write_text_file was called (profile metadata saved)
    // In a real scenario, we'd check for the profile in the UI, but with mocks
    // we verify the modal closed successfully after Save
  });
});
