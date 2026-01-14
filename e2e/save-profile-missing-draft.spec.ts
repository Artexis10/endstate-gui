/**
 * E2E test for Save Profile with missing draft content
 * 
 * Enforces INV-SAVE-1 and INV-SAVE-2:
 * - write_text_file must never be called without content
 * - Missing draft shows correct toast and exits cleanly
 */

import { test, expect } from '@playwright/test';

test.describe('Save Profile - Missing Draft (INV-SAVE-1, INV-SAVE-2)', () => {
  test('shows error toast when draft content is missing', async ({ page }) => {
    await page.goto('http://localhost:1420');
    
    // Wait for app to load
    await page.waitForSelector('[data-testid="app-shell"]', { timeout: 10000 });
    
    // Inject test hook to open Save Profile modal with empty draft
    await page.evaluate(() => {
      const hook = (window as any).__endstate_e2e_openSaveProfileModal;
      if (hook) {
        hook({ draftText: '', suggestedName: 'test-profile' });
      }
    });
    
    // Wait for modal to appear
    await page.waitForSelector('[data-testid="profile-name-modal"]', { timeout: 5000 });
    
    // Click Save button
    await page.click('button:has-text("Save")');
    
    // Verify error toast appears with correct message
    await expect(page.locator('.toast')).toContainText('No capture draft available. Please run Capture again.');
    
    // Verify modal is closed
    await expect(page.locator('[data-testid="profile-name-modal"]')).not.toBeVisible();
  });
  
  test('shows error toast when draft content is whitespace-only', async ({ page }) => {
    await page.goto('http://localhost:1420');
    
    await page.waitForSelector('[data-testid="app-shell"]', { timeout: 10000 });
    
    // Inject test hook with whitespace-only draft
    await page.evaluate(() => {
      const hook = (window as any).__endstate_e2e_openSaveProfileModal;
      if (hook) {
        hook({ draftText: '   \n\t  ', suggestedName: 'test-profile' });
      }
    });
    
    await page.waitForSelector('[data-testid="profile-name-modal"]', { timeout: 5000 });
    
    await page.click('button:has-text("Save")');
    
    // Verify error toast
    await expect(page.locator('.toast')).toContainText('No capture draft available. Please run Capture again.');
    
    // Verify modal is closed
    await expect(page.locator('[data-testid="profile-name-modal"]')).not.toBeVisible();
  });
  
  test('does NOT call write_text_file when draft is missing', async ({ page }) => {
    // Track Tauri invocations
    const tauriCalls: Array<{ cmd: string; args: any }> = [];
    
    await page.goto('http://localhost:1420');
    
    // Intercept Tauri invoke calls
    await page.addInitScript(() => {
      const originalInvoke = (window as any).__TAURI__?.core?.invoke;
      if (originalInvoke) {
        (window as any).__TAURI__.core.invoke = function(cmd: string, args?: any) {
          (window as any).__test_tauri_calls = (window as any).__test_tauri_calls || [];
          (window as any).__test_tauri_calls.push({ cmd, args });
          return originalInvoke.call(this, cmd, args);
        };
      }
    });
    
    await page.waitForSelector('[data-testid="app-shell"]', { timeout: 10000 });
    
    // Open modal with empty draft
    await page.evaluate(() => {
      const hook = (window as any).__endstate_e2e_openSaveProfileModal;
      if (hook) {
        hook({ draftText: '', suggestedName: 'test-profile' });
      }
    });
    
    await page.waitForSelector('[data-testid="profile-name-modal"]', { timeout: 5000 });
    
    // Clear tracked calls before Save
    await page.evaluate(() => {
      (window as any).__test_tauri_calls = [];
    });
    
    await page.click('button:has-text("Save")');
    
    // Wait for toast to appear
    await page.waitForSelector('.toast', { timeout: 5000 });
    
    // Verify write_text_file was NOT called
    const calls = await page.evaluate(() => (window as any).__test_tauri_calls || []);
    const writeTextFileCalls = calls.filter((call: any) => call.cmd === 'write_text_file');
    
    expect(writeTextFileCalls).toHaveLength(0);
  });
});
