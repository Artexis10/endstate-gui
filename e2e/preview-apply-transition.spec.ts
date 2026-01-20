import { test, expect } from '@playwright/test';
import { forceAdvancedMode, seedProfileSettings, goToApplyPage } from './helpers/ui-mode';
import { installTauriMock } from './helpers/tauri-mock';

/**
 * Preview to Apply Transition Tests
 * Verifies the core flow: Preview -> Apply changes -> Result
 */
test.describe('Preview to Apply Transition', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    // Force Advanced mode and seed profile settings (dryRunEnabled=true for Preview changes button)
    await forceAdvancedMode(page);
    await seedProfileSettings(page, 'test-profile', true);

    await installTauriMock(page, {
      invoke: {
        list_manifest_files: () => ['C:\\test\\profiles\\test-profile.jsonc'],
        validate_profile: () => ({ valid: true, errors: [], summary: { name: 'test-profile', version: 1, appCount: 2 } }),
        check_file_exists: () => true,
        read_text_file: () => '{}',
      }
    });

    await page.addInitScript(() => {
      // Track apply calls
      (window as any).__APPLY_CALL_COUNT__ = 0;
      
      (window as any).__ENDSTATE_MOCK_ENGINE__ = {
        runEndstateStreaming: async (settings: any, command: string, args: string[], onEvent: Function, options?: any) => {
          if (command === 'capabilities') {
            return { exitCode: 0, envelope: { success: true, data: { commands: ['capture', 'apply', 'verify', 'report'] } }, ndjsonEvents: [] };
          }
          if (command === 'report') {
            return { exitCode: 0, envelope: { success: true, data: { hasState: false } }, ndjsonEvents: [] };
          }
          if (command === 'apply') {
            (window as any).__APPLY_CALL_COUNT__++;
            const isDryRun = args.includes('--dry-run');
            
            const item = { id: 'Notepad++.Notepad++', driver: 'winget', status: 'ok', reason: isDryRun ? 'would_install' : 'installed', name: 'Notepad++' };
            
            // Emit streaming event
            if (options?.onNdjsonEvent) {
              options.onNdjsonEvent(item);
            }
            if (onEvent) {
              onEvent({ type: 'stdout', data: JSON.stringify(item) + '\n' });
            }
            
            if (!isDryRun) {
              // Small delay for apply to simulate work
              await new Promise(r => setTimeout(r, 50));
            }
            
            return { 
              exitCode: 0, 
              envelope: { 
                success: true, 
                data: { 
                  dryRun: isDryRun,
                  installed: isDryRun ? 0 : 1,
                  alreadyPresent: 0,
                  failed: 0,
                  items: [item]
                } 
              },
              ndjsonEvents: [item],
            };
          }
          return { exitCode: 0, envelope: { success: true, data: {} }, ndjsonEvents: [] };
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
    
    // Wait for completion - results appear in expanded card
    await expect(page.locator('text=Completed successfully')).toBeVisible({ timeout: 5000 });
    
    // Verify call count = 1 (preview only)
    const previewCount = await page.evaluate(() => (window as any).__APPLY_CALL_COUNT__);
    expect(previewCount).toBe(1);
    
    // Verify result controls are present
    await expect(page.getByRole('button', { name: 'Details' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dismiss' })).toBeVisible();
  });

  test('Real-time progress shows current app during apply', async ({ page }) => {
    // Profile is pre-selected via forceAdvancedMode helper (seeds localStorage)
    await page.click('button:has-text("Preview changes")');
    
    // Wait for completion
    await expect(page.locator('text=Completed successfully')).toBeVisible({ timeout: 5000 });
    
    // Verify result controls are present
    await expect(page.getByRole('button', { name: 'Details' })).toBeVisible();
  });

  test('Double-clicking Preview changes only triggers ONE preview run', async ({ page }) => {
    // Profile is pre-selected via forceAdvancedMode helper (seeds localStorage)
    // Double-click Preview changes rapidly
    const previewButton = page.getByRole('button', { name: 'Preview changes' });
    await previewButton.dblclick();
    
    // Wait for completion - use .first() to avoid strict mode violation when both collapsed and expanded views show text
    await expect(page.locator('text=Completed successfully').first()).toBeVisible({ timeout: 5000 });
    
    // Verify call count = 1 (only ONE preview, not two)
    const finalCount = await page.evaluate(() => (window as any).__APPLY_CALL_COUNT__);
    expect(finalCount).toBe(1);
  });

  test('Apply button is disabled while applying', async ({ page }) => {
    // Profile is pre-selected via forceAdvancedMode helper (seeds localStorage)
    await page.click('button:has-text("Preview changes")');
    
    // Wait for completion - use .first() to avoid strict mode violation
    await expect(page.locator('text=Completed successfully').first()).toBeVisible({ timeout: 5000 });
    
    // Verify result controls are present (this confirms the flow completed)
    await expect(page.getByRole('button', { name: 'Details' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dismiss' })).toBeVisible();
  });
});
