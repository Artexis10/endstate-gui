import { test, expect } from '@playwright/test';

/**
 * E2E tests for Save Profile opt-in behavior.
 * 
 * These tests verify that:
 * 1. Cancel/X/Escape does NOT create a saved profile
 * 2. Only clicking "Save profile" creates the profile
 */
test.describe('Save Profile - Opt-in Behavior', () => {
  // Track delete calls to verify profile deletion on cancel
  let deleteFileCalls: string[] = [];
  let profileFiles: string[] = [];

  test.beforeEach(async ({ page, baseURL }) => {
    deleteFileCalls = [];
    profileFiles = ['C:\\test\\existing-profile.jsonc'];

    await page.addInitScript(() => {
      const deleteFileCalls: string[] = [];
      const profileFiles = ['C:\\test\\existing-profile.jsonc'];
      
      (window as any).__test_deleteFileCalls = deleteFileCalls;
      (window as any).__test_profileFiles = profileFiles;

      (window as any).__TAURI__ = {
        core: {
          invoke: async (cmd: string, args?: any) => {
            if (cmd === 'ensure_dir') return null;
            if (cmd === 'read_dir') return [];
            if (cmd === 'list_manifest_files') {
              return (window as any).__test_profileFiles.map((p: string) => p);
            }
            if (cmd === 'get_default_profiles_directory') return 'C:\\test\\profiles';
            if (cmd === 'read_text_file') return '{"version": 1, "apps": []}';
            if (cmd === 'write_text_file') return null;
            if (cmd === 'check_file_exists') return true;
            if (cmd === 'validate_profile') {
              return { valid: true, summary: { name: 'test', version: 1, appCount: 0 } };
            }
            if (cmd === 'delete_file') {
              (window as any).__test_deleteFileCalls.push(args?.path);
              // Remove from profile files list
              const idx = (window as any).__test_profileFiles.indexOf(args?.path);
              if (idx > -1) {
                (window as any).__test_profileFiles.splice(idx, 1);
              }
              return null;
            }
            return null;
          }
        }
      };

      (window as any).__ENDSTATE_MOCK_ENGINE__ = {
        runEndstateStreaming: async (settings: any, command: string) => {
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

  test('Cancel button deletes profile file in save mode', async ({ page }) => {
    // Simulate a newly captured profile path
    const newProfilePath = 'C:\\test\\profiles\\setup_2024-12-31_23-59-00.jsonc';
    
    // Add the new profile to the list (simulating capture just completed)
    await page.evaluate((path) => {
      (window as any).__test_profileFiles.push(path);
    }, newProfilePath);

    // Open the Save profile modal with the new profile path
    await page.evaluate((path) => {
      // Directly set the modal state to simulate post-capture flow
      (window as any).__endstate_e2e_openSaveProfileModal({ suggestedName: 'My New Profile' });
    }, newProfilePath);

    await expect(page.locator('[data-testid="profile-name-modal"]')).toBeVisible({ timeout: 3000 });

    // Click Cancel
    await page.click('[data-testid="profile-name-cancel"]');
    await page.waitForTimeout(500);

    // Modal should close
    await expect(page.locator('[data-testid="profile-name-modal"]')).not.toBeVisible();

    // Verify delete_file was called (profile deletion on cancel)
    const deleteCalls = await page.evaluate(() => (window as any).__test_deleteFileCalls);
    // In the test hook, the path is 'C:\\test\\profile.jsonc' - verify deletion was attempted
    expect(deleteCalls.length).toBeGreaterThanOrEqual(1);
  });

  test('Save button does NOT delete profile file', async ({ page }) => {
    // Open the Save profile modal
    await page.evaluate(() => {
      (window as any).__endstate_e2e_openSaveProfileModal({ suggestedName: 'Keep This Profile' });
    });

    await expect(page.locator('[data-testid="profile-name-modal"]')).toBeVisible({ timeout: 3000 });

    // Click Save
    await page.click('[data-testid="profile-name-save"]');
    await page.waitForTimeout(500);

    // Modal should close
    await expect(page.locator('[data-testid="profile-name-modal"]')).not.toBeVisible();

    // Verify delete_file was NOT called
    const deleteCalls = await page.evaluate(() => (window as any).__test_deleteFileCalls);
    expect(deleteCalls.length).toBe(0);
  });

  test('Escape key triggers cancel behavior in save mode', async ({ page }) => {
    // Open the Save profile modal
    await page.evaluate(() => {
      (window as any).__endstate_e2e_openSaveProfileModal({ suggestedName: 'Escape Test' });
    });

    await expect(page.locator('[data-testid="profile-name-modal"]')).toBeVisible({ timeout: 3000 });

    // Press Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Modal should close (Escape now triggers cancel which deletes profile)
    await expect(page.locator('[data-testid="profile-name-modal"]')).not.toBeVisible();

    // Verify delete_file was called
    const deleteCalls = await page.evaluate(() => (window as any).__test_deleteFileCalls);
    expect(deleteCalls.length).toBeGreaterThanOrEqual(1);
  });
});
