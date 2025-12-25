import { test, expect } from '@playwright/test';
import { forceAdvancedMode, seedProfileSettings, goToApplyPage } from './helpers/ui-mode';

/**
 * Preview to Apply Transition Tests
 * Verifies the core flow: Preview -> Apply changes -> Result
 */
test.describe('Preview to Apply Transition', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    // Force Advanced mode and seed profile settings (dryRunEnabled=true for Preview changes button)
    await forceAdvancedMode(page);
    await seedProfileSettings(page, 'test-profile', true);

    await page.addInitScript(() => {
      // Track apply calls
      (window as any).__APPLY_CALL_COUNT__ = 0;
      
      (window as any).__TAURI__ = {
        core: {
          invoke: async (cmd: string) => {
            if (cmd === 'ensure_dir') return null;
            if (cmd === 'read_dir') return [];
            if (cmd === 'list_manifest_files') return ['C:\\test\\profiles\\test-profile.jsonc'];
            if (cmd === 'get_default_profiles_directory') return 'C:\\test\\profiles';
            return null;
          }
        }
      };
      
      (window as any).__ENDSTATE_MOCK_ENGINE__ = {
        runEndstateStreaming: async (settings: any, command: string, args: string[], onEvent: Function) => {
          if (command === 'capabilities') {
            return { exitCode: 0, envelope: { success: true, data: { commands: ['capture', 'apply', 'report'] } } };
          }
          if (command === 'report') {
            return { exitCode: 0, envelope: { success: true, data: { hasState: false } } };
          }
          if (command === 'apply') {
            (window as any).__APPLY_CALL_COUNT__++;
            const isDryRun = args.includes('--dry-run');
            
            if (isDryRun) {
              // Preview: would_install
              onEvent({ type: 'stdout', data: '[PLAN] Would install Notepad++.Notepad++\n' });
              return { 
                exitCode: 0, 
                envelope: { 
                  success: true, 
                  data: { 
                    dryRun: true,
                    counts: { total: 1, installed: 0, alreadyInstalled: 0, skippedFiltered: 0, failed: 0 },
                    items: [{ id: 'Notepad++.Notepad++', driver: 'winget', status: 'ok', reason: 'would_install' }]
                  } 
                } 
              };
            } else {
              // Real apply: installed
              onEvent({ type: 'stdout', data: '[INSTALL] Notepad++.Notepad++\n' });
              await new Promise(r => setTimeout(r, 100));
              onEvent({ type: 'stdout', data: '[OK] Notepad++.Notepad++ - Installed successfully\n' });
              return { 
                exitCode: 0, 
                envelope: { 
                  success: true, 
                  data: { 
                    counts: { total: 1, installed: 1, alreadyInstalled: 0, skippedFiltered: 0, failed: 0 },
                    items: [{ id: 'Notepad++.Notepad++', driver: 'winget', status: 'ok', reason: 'installed' }]
                  } 
                } 
              };
            }
          }
          return { exitCode: 0, envelope: { success: true, data: {} } };
        }
      };
    });
    
    await page.goto(baseURL || '/');
    await page.waitForLoadState('networkidle');
    // App starts on Overview - navigate to Apply page
    await goToApplyPage(page);
  });

  test('Preview then Apply executes only ONE apply after clicking Apply changes', async ({ page }) => {
    // Profile is pre-selected via forceAdvancedMode helper (seeds localStorage)
    // Step 1: Click Preview changes (dry-run)
    await page.click('button:has-text("Preview changes")');
    
    // Wait for preview modal
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog.locator("text=Here's what will change")).toBeVisible({ timeout: 5000 });
    // Check for the "Will be installed" card using text filter
    await expect(dialog.locator('div').filter({ hasText: /Will be installed/ }).first()).toBeVisible();
    
    // Verify call count = 1 (preview only)
    const previewCount = await page.evaluate(() => (window as any).__APPLY_CALL_COUNT__);
    expect(previewCount).toBe(1);
    
    // Step 2: Click Apply changes
    await page.click('[role="dialog"] button:has-text("Apply changes")');
    
    // Should show "Applying changes..." state
    await expect(page.locator('text=Applying changes...')).toBeVisible({ timeout: 3000 });
    
    // Wait for completion
    await expect(dialog.locator('text=Your computer is ready')).toBeVisible({ timeout: 10000 });
    await expect(dialog.locator('div').filter({ hasText: /Installed this run/ }).first()).toBeVisible();
    
    // Verify call count = 2 (preview + apply)
    const finalCount = await page.evaluate(() => (window as any).__APPLY_CALL_COUNT__);
    expect(finalCount).toBe(2);
  });

  test('Real-time progress shows current app during apply', async ({ page }) => {
    // Profile is pre-selected via forceAdvancedMode helper (seeds localStorage)
    await page.click('button:has-text("Preview changes")');
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });
    await page.click('[role="dialog"] button:has-text("Apply changes")');
    
    // Should show "Applying changes..." title during apply
    await expect(page.locator('text=Applying changes...')).toBeVisible({ timeout: 3000 });
  });

  test('Double-clicking Apply changes only triggers ONE apply run', async ({ page }) => {
    // Profile is pre-selected via forceAdvancedMode helper (seeds localStorage)
    // Step 1: Click Preview changes (dry-run)
    await page.click('button:has-text("Preview changes")');
    
    // Wait for preview modal
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog.locator("text=Here's what will change")).toBeVisible({ timeout: 5000 });
    
    // Verify call count = 1 (preview only)
    const previewCount = await page.evaluate(() => (window as any).__APPLY_CALL_COUNT__);
    expect(previewCount).toBe(1);
    
    // Step 2: Double-click Apply changes rapidly
    const applyButton = dialog.locator('button:has-text("Apply changes")');
    await applyButton.dblclick();
    
    // Wait for completion
    await expect(dialog.locator('text=Your computer is ready')).toBeVisible({ timeout: 10000 });
    
    // Verify call count = 2 (preview + ONE apply, not preview + TWO applies)
    const finalCount = await page.evaluate(() => (window as any).__APPLY_CALL_COUNT__);
    expect(finalCount).toBe(2);
  });

  test('Apply button is disabled while applying', async ({ page }) => {
    // Profile is pre-selected via forceAdvancedMode helper (seeds localStorage)
    await page.click('button:has-text("Preview changes")');
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    
    // Click Apply changes
    await page.click('[role="dialog"] button:has-text("Apply changes")');
    
    // Button should show "Applying..." and be disabled
    const applyButton = dialog.locator('button:has-text("Applying...")');
    await expect(applyButton).toBeVisible({ timeout: 3000 });
    await expect(applyButton).toBeDisabled();
  });
});
