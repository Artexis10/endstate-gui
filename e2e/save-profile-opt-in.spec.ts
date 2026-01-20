import { test, expect } from '@playwright/test';
import { forceAdvancedMode } from './helpers/ui-mode';
import { installTauriMock } from './helpers/tauri-mock';

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
    await forceAdvancedMode(page);
    
    // Use the updated Tauri mock with built-in test trackers
    // The mock now initializes __test_profileFiles, __test_renameFileCalls, etc.
    await installTauriMock(page, {
      initialProfileFiles: [EXISTING_PROFILE_PATH],
      invoke: {
        validate_profile: () => ({ valid: true, errors: [], summary: { name: 'test', version: 1, appCount: 0 } }),
      }
    });

    await page.addInitScript(() => {
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
    
    await page.waitForFunction(() => typeof (window as any).__endstate_e2e_openSaveProfileModal === 'function', { timeout: 10000 });
  });

  test('Cancel button closes modal without deleting draft', async ({ page }) => {
    // Old assertion: expected delete_file to be called on Cancel
    // New contract: Cancel closes modal but draft persists for later save (per product spec)
    
    // Add the pending profile to the mock filesystem (simulates capture creating draft)
    await page.evaluate((pendingPath) => {
      (window as any).__test_profileFiles.add(pendingPath);
      (window as any).__test_fileContents.set(pendingPath, '{"version": 1, "apps": []}');
    }, PENDING_PROFILE_PATH);
    
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

    // Modal should close
    await expect(page.locator('[data-testid="profile-name-modal"]')).not.toBeVisible();

    // Draft file should still exist (Cancel does NOT delete - user can return later)
    const profileFiles = await page.evaluate(() => Array.from((window as any).__test_profileFiles));
    expect(profileFiles).toContain(PENDING_PROFILE_PATH);
    expect(profileFiles).toContain(EXISTING_PROFILE_PATH);
  });

  test('Save button renames file to match typed name', async ({ page }) => {
    // Open the Save profile modal with draft text (E2E hook expects draftText, not pendingPath)
    await page.evaluate(() => {
      (window as any).__endstate_e2e_openSaveProfileModal({ 
        draftText: '{"version": 1, "apps": [{"name": "test-app"}]}',
        suggestedName: 'Default Name' 
      });
    });

    await expect(page.locator('[data-testid="profile-name-modal"]')).toBeVisible({ timeout: 3000 });

    // Type a custom name
    const input = page.locator('[data-testid="profile-name-input"]');
    await input.clear();
    await input.fill('Work Laptop Setup');

    // Click Save
    await page.click('[data-testid="profile-name-save"]');

    // Modal should close
    await expect(page.locator('[data-testid="profile-name-modal"]')).not.toBeVisible();

    // Product behavior: Save mode writes a NEW file (write_text_file), not rename
    // The filename is derived from the typed name
    const writeCalls = await page.evaluate(() => (window as any).__test_writeFileCalls);
    
    // Should have at least one write for the manifest file
    const manifestWrite = writeCalls.find((c: any) => c.path.endsWith('.jsonc') && !c.path.endsWith('.meta.json'));
    expect(manifestWrite).toBeDefined();
    expect(manifestWrite.path).toContain('Work_Laptop_Setup');

    // Verify metadata was written with display name
    const metaWrite = writeCalls.find((c: any) => c.path.endsWith('.meta.json'));
    expect(metaWrite).toBeDefined();
    expect(JSON.parse(metaWrite.content).displayName).toBe('Work Laptop Setup');
  });

  test('Save with empty name keeps original filename', async ({ page }) => {
    // Add the pending profile to the mock filesystem (simulates capture creating draft)
    await page.evaluate((pendingPath) => {
      (window as any).__test_profileFiles.add(pendingPath);
      (window as any).__test_fileContents.set(pendingPath, '{"version": 1, "apps": []}');
    }, PENDING_PROFILE_PATH);
    
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

    // Modal should close
    await expect(page.locator('[data-testid="profile-name-modal"]')).not.toBeVisible();

    // Verify rename_file was NOT called (filename unchanged)
    const renameCalls = await page.evaluate(() => (window as any).__test_renameFileCalls);
    expect(renameCalls.length).toBe(0);

    // Verify delete_file was NOT called
    const deleteCalls = await page.evaluate(() => (window as any).__test_deleteFileCalls);
    expect(deleteCalls).not.toContain(PENDING_PROFILE_PATH);

    // Verify the pending profile is still in the list
    const profileFiles = await page.evaluate(() => Array.from((window as any).__test_profileFiles));
    expect(profileFiles).toContain(PENDING_PROFILE_PATH);
  });

  test('Escape key triggers cancel behavior without deleting draft', async ({ page }) => {
    // Old assertion: expected delete_file to be called on Escape
    // New contract: Escape triggers Cancel which closes modal but draft persists (per product spec)
    
    // Add the pending profile to the mock filesystem (simulates capture creating draft)
    await page.evaluate((pendingPath) => {
      (window as any).__test_profileFiles.add(pendingPath);
      (window as any).__test_fileContents.set(pendingPath, '{"version": 1, "apps": []}');
    }, PENDING_PROFILE_PATH);
    
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

    // Modal should close
    await expect(page.locator('[data-testid="profile-name-modal"]')).not.toBeVisible();

    // Draft file should still exist (Cancel does NOT delete - user can return later)
    const profileFiles = await page.evaluate(() => Array.from((window as any).__test_profileFiles));
    expect(profileFiles).toContain(PENDING_PROFILE_PATH);
  });

  test('Manage Profiles list unchanged after Cancel', async ({ page }) => {
    // Old assertion: expected profile count to decrease by 1 (delete on Cancel)
    // New contract: Cancel does NOT delete draft, so profile count stays the same
    
    // Get initial profile count (use .size for Set)
    const initialProfiles = await page.evaluate(() => (window as any).__test_profileFiles.size);

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
    await expect(page.locator('[data-testid="profile-name-modal"]')).not.toBeVisible();

    // Verify profile count unchanged (Cancel does NOT delete draft)
    const finalProfiles = await page.evaluate(() => (window as any).__test_profileFiles.size);
    expect(finalProfiles).toBe(initialProfiles);

    // Verify existing profile still exists
    const profileFiles = await page.evaluate(() => Array.from((window as any).__test_profileFiles));
    expect(profileFiles).toContain(EXISTING_PROFILE_PATH);
  });
});
