import { test, expect } from '@playwright/test';
import { forceAdvancedMode } from './helpers/ui-mode';

/**
 * E2E tests for Save Profile opt-in behavior.
 * 
 * These tests verify that:
 * 1. Cancel/X/Escape deletes the pending profile file
 * 2. Save renames the file to match the typed name
 * 3. The display name matches what was typed in the modal
 */
test.describe('Save Profile - Opt-in Behavior', () => {
  // Track file operations to verify behavior
  const PENDING_PROFILE_PATH = 'C:\\test\\profiles\\setup_2024-12-31_23-59-00.jsonc';
  const EXISTING_PROFILE_PATH = 'C:\\test\\profiles\\existing-profile.jsonc';

  test.beforeEach(async ({ page, baseURL }) => {
    // Force advanced mode for sidebar navigation
    await forceAdvancedMode(page);
    
    await page.addInitScript(() => {
      const deleteFileCalls: string[] = [];
      const renameFileCalls: { oldPath: string; newPath: string }[] = [];
      const writeFileCalls: { path: string; content: string }[] = [];
      const profileFiles = [
        'C:\\test\\profiles\\existing-profile.jsonc',
        'C:\\test\\profiles\\setup_2024-12-31_23-59-00.jsonc', // Pending profile
      ];
      
      (window as any).__test_deleteFileCalls = deleteFileCalls;
      (window as any).__test_renameFileCalls = renameFileCalls;
      (window as any).__test_writeFileCalls = writeFileCalls;
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
            if (cmd === 'read_text_file') {
              // Return metadata if it exists
              if (args?.path?.endsWith('.meta.json')) {
                const metaFiles = (window as any).__test_writeFileCalls
                  .filter((c: any) => c.path === args.path);
                if (metaFiles.length > 0) {
                  return metaFiles[metaFiles.length - 1].content;
                }
                throw new Error('File not found');
              }
              return '{"version": 1, "apps": []}';
            }
            if (cmd === 'write_text_file') {
              (window as any).__test_writeFileCalls.push({ path: args?.path, content: args?.content });
              return null;
            }
            if (cmd === 'check_file_exists') {
              const path = args?.path;
              // Check if file is in our list
              if ((window as any).__test_profileFiles.includes(path)) return true;
              // Check if it's a meta file we've written
              const metaWritten = (window as any).__test_writeFileCalls.some((c: any) => c.path === path);
              if (metaWritten) return true;
              return false;
            }
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
            if (cmd === 'rename_file') {
              (window as any).__test_renameFileCalls.push({ oldPath: args?.oldPath, newPath: args?.newPath });
              // Update profile files list
              const idx = (window as any).__test_profileFiles.indexOf(args?.oldPath);
              if (idx > -1) {
                (window as any).__test_profileFiles[idx] = args?.newPath;
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
    
    // Wait for the E2E hook to be available
    await page.waitForFunction(() => typeof (window as any).__endstate_e2e_openSaveProfileModal === 'function', { timeout: 10000 });
  });

  test('Cancel button closes modal without deleting draft', async ({ page }) => {
    // Old assertion: expected delete_file to be called on Cancel
    // New contract: Cancel closes modal but draft persists for later save (per product spec)
    
    // Open the Save profile modal with the pending profile path
    await page.evaluate((pendingPath) => {
      (window as any).__endstate_e2e_openSaveProfileModal({ 
        pendingPath, 
        suggestedName: 'My New Profile' 
      });
    }, PENDING_PROFILE_PATH);

    await expect(page.locator('[data-testid="profile-name-modal"]')).toBeVisible({ timeout: 3000 });

    // Click Cancel
    await page.click('[data-testid="profile-name-cancel"]');
    await page.waitForTimeout(500);

    // Modal should close
    await expect(page.locator('[data-testid="profile-name-modal"]')).not.toBeVisible();

    // Draft file should still exist (Cancel does NOT delete - user can return later)
    const profileFiles = await page.evaluate(() => (window as any).__test_profileFiles);
    expect(profileFiles).toContain(PENDING_PROFILE_PATH);
    expect(profileFiles).toContain(EXISTING_PROFILE_PATH);
  });

  test('Save button renames file to match typed name', async ({ page }) => {
    // Open the Save profile modal with the pending profile path
    await page.evaluate((pendingPath) => {
      (window as any).__endstate_e2e_openSaveProfileModal({ 
        pendingPath, 
        suggestedName: 'Default Name' 
      });
    }, PENDING_PROFILE_PATH);

    await expect(page.locator('[data-testid="profile-name-modal"]')).toBeVisible({ timeout: 3000 });

    // Type a custom name
    const input = page.locator('[data-testid="profile-name-input"]');
    await input.clear();
    await input.fill('Work Laptop Setup');

    // Click Save
    await page.click('[data-testid="profile-name-save"]');
    await page.waitForTimeout(500);

    // Modal should close
    await expect(page.locator('[data-testid="profile-name-modal"]')).not.toBeVisible();

    // Verify rename_file was called
    const renameCalls = await page.evaluate(() => (window as any).__test_renameFileCalls);
    expect(renameCalls.length).toBe(1);
    expect(renameCalls[0].oldPath).toBe(PENDING_PROFILE_PATH);
    expect(renameCalls[0].newPath).toContain('Work_Laptop_Setup');
    expect(renameCalls[0].newPath).toMatch(/\.jsonc$/);

    // Verify delete_file was NOT called
    const deleteCalls = await page.evaluate(() => (window as any).__test_deleteFileCalls);
    expect(deleteCalls).not.toContain(PENDING_PROFILE_PATH);

    // Verify metadata was written with display name
    const writeCalls = await page.evaluate(() => (window as any).__test_writeFileCalls);
    const metaWrite = writeCalls.find((c: any) => c.path.endsWith('.meta.json'));
    expect(metaWrite).toBeDefined();
    expect(JSON.parse(metaWrite.content).displayName).toBe('Work Laptop Setup');
  });

  test('Save with empty name keeps original filename', async ({ page }) => {
    // Open the Save profile modal with the pending profile path
    await page.evaluate((pendingPath) => {
      (window as any).__endstate_e2e_openSaveProfileModal({ 
        pendingPath, 
        suggestedName: '' 
      });
    }, PENDING_PROFILE_PATH);

    await expect(page.locator('[data-testid="profile-name-modal"]')).toBeVisible({ timeout: 3000 });

    // Leave input empty and click Save
    const input = page.locator('[data-testid="profile-name-input"]');
    await input.clear();
    await page.click('[data-testid="profile-name-save"]');
    await page.waitForTimeout(500);

    // Modal should close
    await expect(page.locator('[data-testid="profile-name-modal"]')).not.toBeVisible();

    // Verify rename_file was NOT called (filename unchanged)
    const renameCalls = await page.evaluate(() => (window as any).__test_renameFileCalls);
    expect(renameCalls.length).toBe(0);

    // Verify delete_file was NOT called
    const deleteCalls = await page.evaluate(() => (window as any).__test_deleteFileCalls);
    expect(deleteCalls).not.toContain(PENDING_PROFILE_PATH);

    // Verify the pending profile is still in the list
    const profileFiles = await page.evaluate(() => (window as any).__test_profileFiles);
    expect(profileFiles).toContain(PENDING_PROFILE_PATH);
  });

  test('Escape key triggers cancel behavior without deleting draft', async ({ page }) => {
    // Old assertion: expected delete_file to be called on Escape
    // New contract: Escape triggers Cancel which closes modal but draft persists (per product spec)
    
    // Open the Save profile modal
    await page.evaluate((pendingPath) => {
      (window as any).__endstate_e2e_openSaveProfileModal({ 
        pendingPath, 
        suggestedName: 'Escape Test' 
      });
    }, PENDING_PROFILE_PATH);

    await expect(page.locator('[data-testid="profile-name-modal"]')).toBeVisible({ timeout: 3000 });

    // Press Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Modal should close
    await expect(page.locator('[data-testid="profile-name-modal"]')).not.toBeVisible();

    // Draft file should still exist (Cancel does NOT delete - user can return later)
    const profileFiles = await page.evaluate(() => (window as any).__test_profileFiles);
    expect(profileFiles).toContain(PENDING_PROFILE_PATH);
  });

  test('Manage Profiles list unchanged after Cancel', async ({ page }) => {
    // Old assertion: expected profile count to decrease by 1 (delete on Cancel)
    // New contract: Cancel does NOT delete draft, so profile count stays the same
    
    // Get initial profile count
    const initialProfiles = await page.evaluate(() => (window as any).__test_profileFiles.length);

    // Open the Save profile modal
    await page.evaluate((pendingPath) => {
      (window as any).__endstate_e2e_openSaveProfileModal({ 
        pendingPath, 
        suggestedName: 'Will Cancel' 
      });
    }, PENDING_PROFILE_PATH);

    await expect(page.locator('[data-testid="profile-name-modal"]')).toBeVisible({ timeout: 3000 });

    // Click Cancel
    await page.click('[data-testid="profile-name-cancel"]');
    await page.waitForTimeout(500);

    // Verify profile count unchanged (Cancel does NOT delete draft)
    const finalProfiles = await page.evaluate(() => (window as any).__test_profileFiles.length);
    expect(finalProfiles).toBe(initialProfiles);

    // Verify existing profile still exists
    const profileFiles = await page.evaluate(() => (window as any).__test_profileFiles);
    expect(profileFiles).toContain(EXISTING_PROFILE_PATH);
  });
});
