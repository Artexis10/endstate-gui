/**
 * E2E test for Save Profile with missing draft content
 * 
 * Enforces INV-SAVE-1 and INV-SAVE-2:
 * - write_text_file must never be called without content
 * - Missing draft shows correct toast and exits cleanly
 */

import { test, expect } from '@playwright/test';
import { installTauriMock } from './helpers/tauri-mock';
import { forceAdvancedMode } from './helpers/ui-mode';

test.describe('Save Profile - Missing Draft (INV-SAVE-1, INV-SAVE-2)', () => {
  test.beforeEach(async ({ page }) => {
    await forceAdvancedMode(page);
    
    await installTauriMock(page, {
      allowUnknownInvokes: true,
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
  });

  test('shows error toast when draft content is missing', async ({ page, baseURL }) => {
    await page.goto(baseURL || '/');
    await page.waitForLoadState('networkidle');
    
    // Wait for E2E hooks to be available
    await page.waitForFunction(() => typeof (window as any).__endstate_e2e_openSaveProfileModal === 'function', { timeout: 10000 });
    
    // Open Save Profile modal with empty draft
    await page.evaluate(() => {
      (window as any).__endstate_e2e_openSaveProfileModal({ draftText: '', suggestedName: 'test-profile' });
    });
    
    // Wait for modal to appear
    await expect(page.locator('[data-testid="profile-name-modal"]')).toBeVisible({ timeout: 5000 });
    
    // Click Save button
    await page.click('[data-testid="profile-name-save"]');
    
    // Verify error toast appears with correct message
    await expect(page.locator('[data-sonner-toast]')).toContainText('No capture draft available', { timeout: 5000 });
    
    // Verify modal is closed
    await expect(page.locator('[data-testid="profile-name-modal"]')).not.toBeVisible();
  });
  
  test('shows error toast when draft content is whitespace-only', async ({ page, baseURL }) => {
    await page.goto(baseURL || '/');
    await page.waitForLoadState('networkidle');
    
    await page.waitForFunction(() => typeof (window as any).__endstate_e2e_openSaveProfileModal === 'function', { timeout: 10000 });
    
    // Open modal with whitespace-only draft
    await page.evaluate(() => {
      (window as any).__endstate_e2e_openSaveProfileModal({ draftText: '   \n\t  ', suggestedName: 'test-profile' });
    });
    
    await expect(page.locator('[data-testid="profile-name-modal"]')).toBeVisible({ timeout: 5000 });
    
    await page.click('[data-testid="profile-name-save"]');
    
    // Verify error toast
    await expect(page.locator('[data-sonner-toast]')).toContainText('No capture draft available', { timeout: 5000 });
    
    // Verify modal is closed
    await expect(page.locator('[data-testid="profile-name-modal"]')).not.toBeVisible();
  });
  
  test('does NOT call write_text_file when draft is missing', async ({ page, baseURL }) => {
    await page.goto(baseURL || '/');
    await page.waitForLoadState('networkidle');
    
    await page.waitForFunction(() => typeof (window as any).__endstate_e2e_openSaveProfileModal === 'function', { timeout: 10000 });
    
    // Open modal with empty draft
    await page.evaluate(() => {
      (window as any).__endstate_e2e_openSaveProfileModal({ draftText: '', suggestedName: 'test-profile' });
    });
    
    await expect(page.locator('[data-testid="profile-name-modal"]')).toBeVisible({ timeout: 5000 });
    
    // Clear tracked write calls before Save
    await page.evaluate(() => {
      (window as any).__test_writeFileCalls = [];
    });
    
    await page.click('[data-testid="profile-name-save"]');
    
    // Wait for toast to appear
    await expect(page.locator('[data-sonner-toast]')).toBeVisible({ timeout: 5000 });
    
    // Verify write_text_file was NOT called (use the built-in tracker from Tauri mock)
    const writeCalls = await page.evaluate(() => (window as any).__test_writeFileCalls || []);
    expect(writeCalls).toHaveLength(0);
  });
});
