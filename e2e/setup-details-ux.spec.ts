import { test, expect } from '@playwright/test';
import { forceAdvancedMode, seedProfileSettings, goToApplyPage } from './helpers/ui-mode';

/**
 * E2E tests for Setup Details modal UX improvements:
 * - Badge text not clipped (shows "Will be installed" not "WOULD I")
 * - Close button shows "Close" not "Done"
 * 
 * These tests use Advanced mode for simpler navigation to the Apply page.
 */

test.describe('Apply Modal UX - Button Labels', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await forceAdvancedMode(page);
    await seedProfileSettings(page, 'test-profile', true);

    await page.addInitScript(() => {
      (window as any).__TAURI__ = {
        core: {
          invoke: async (cmd: string) => {
            if (cmd === 'ensure_dir') return null;
            if (cmd === 'read_dir') return [];
            if (cmd === 'list_manifest_files') return ['C:\\test\\profiles\\test-profile.jsonc'];
            if (cmd === 'get_default_profiles_directory') return 'C:\\test\\profiles';
            return null;
          }
        },
        event: { listen: async () => () => {} }
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
            // All apps already installed - simple success case
            onEvent({ type: 'stdout', data: '[SKIP] App1 - already installed\n' });
            
            return { 
              exitCode: 0, 
              envelope: { 
                success: true,
                data: { 
                  counts: {
                    total: 1,
                    installed: 0,
                    alreadyInstalled: 1,
                    skippedFiltered: 0,
                    failed: 0
                  },
                  items: [
                    { id: 'App1', driver: 'winget', status: 'skipped', reason: 'already_installed' }
                  ]
                } 
              } 
            };
          }
          return { exitCode: 0, envelope: { success: true, data: {} } };
        }
      };
    });
    
    await page.goto(baseURL || '/');
    await page.waitForLoadState('networkidle');
    await goToApplyPage(page);
  });

  test('Apply modal shows "Close" button not "Done"', async ({ page }) => {
    // Click Preview changes
    await page.click('button:has-text("Preview changes")');
    
    // Wait for modal
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5000 });
    
    // Should have "Close" button (the main one, not the X button)
    const mainCloseButton = modal.locator('button:has-text("Close")').first();
    await expect(mainCloseButton).toBeVisible();
    // Verify it's the main button (has w-full class)
    await expect(mainCloseButton).toHaveClass(/w-full/);
    // Should NOT have "Done" button
    const doneButtons = await modal.locator('button').filter({ hasText: /^Done$/ }).count();
    expect(doneButtons).toBe(0);
  });
});

test.describe('Apply Modal UX - Badge Text', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await forceAdvancedMode(page);
    await seedProfileSettings(page, 'test-profile', true);

    await page.addInitScript(() => {
      (window as any).__TAURI__ = {
        core: {
          invoke: async (cmd: string) => {
            if (cmd === 'ensure_dir') return null;
            if (cmd === 'read_dir') return [];
            if (cmd === 'list_manifest_files') return ['C:\\test\\profiles\\test-profile.jsonc'];
            if (cmd === 'get_default_profiles_directory') return 'C:\\test\\profiles';
            return null;
          }
        },
        event: { listen: async () => () => {} }
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
            // Dry run with would_install items
            onEvent({ type: 'stdout', data: '[PLAN] Would install TestApp.App\n' });
            
            return { 
              exitCode: 0, 
              envelope: { 
                success: true, 
                data: { 
                  dryRun: true,
                  counts: {
                    total: 1,
                    installed: 0,
                    alreadyInstalled: 0,
                    skippedFiltered: 0,
                    failed: 0
                  },
                  items: [
                    { id: 'TestApp.App', driver: 'winget', status: 'ok', reason: 'would_install' }
                  ]
                } 
              } 
            };
          }
          return { exitCode: 0, envelope: { success: true, data: {} } };
        }
      };
    });
    
    await page.goto(baseURL || '/');
    await page.waitForLoadState('networkidle');
    await goToApplyPage(page);
  });

  test('badge shows full "Will be installed" text, not truncated', async ({ page }) => {
    // Click Preview changes
    await page.click('button:has-text("Preview changes")');
    
    // Wait for modal
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5000 });
    
    // Expand details section
    const detailsButton = modal.locator('button:has-text("Details")');
    if (await detailsButton.isVisible()) {
      await detailsButton.click();
    }
    
    // Badge should show full text "Will be installed" - check the badge element specifically
    // The badge has specific styling classes
    const badge = modal.locator('span.rounded-full:has-text("Will be installed")');
    await expect(badge).toBeVisible({ timeout: 3000 });
    // Should NOT be truncated to "WOULD I" or similar
    await expect(modal.locator('text=WOULD I')).not.toBeVisible();
  });
});

test.describe('Apply Modal UX - Failure Status', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await forceAdvancedMode(page);
    await seedProfileSettings(page, 'test-profile', true); // Use preview mode, then test actual apply

    await page.addInitScript(() => {
      (window as any).__TAURI__ = {
        core: {
          invoke: async (cmd: string) => {
            if (cmd === 'ensure_dir') return null;
            if (cmd === 'read_dir') return [];
            if (cmd === 'list_manifest_files') return ['C:\\test\\profiles\\test-profile.jsonc'];
            if (cmd === 'get_default_profiles_directory') return 'C:\\test\\profiles';
            return null;
          }
        },
        event: { listen: async () => () => {} }
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
            // Simulate a failed apply (works for both preview and actual apply)
            onEvent({ type: 'stdout', data: '[FAIL] FailingApp.App - installation failed\n' });
            
            return { 
              exitCode: 1, 
              envelope: { 
                success: false,
                error: null, // Partial failure, not hard error
                data: { 
                  counts: {
                    total: 1,
                    installed: 0,
                    alreadyInstalled: 0,
                    skippedFiltered: 0,
                    failed: 1
                  },
                  items: [
                    { id: 'FailingApp.App', driver: 'winget', status: 'failed', reason: 'install_failed', message: 'Package not found' }
                  ]
                } 
              } 
            };
          }
          return { exitCode: 0, envelope: { success: true, data: {} } };
        }
      };
    });
    
    await page.goto(baseURL || '/');
    await page.waitForLoadState('networkidle');
    await goToApplyPage(page);
  });

  test('Apply modal shows failure status when apps fail', async ({ page }) => {
    // Click Preview changes (dryRunEnabled=true means preview button is shown)
    await page.click('button:has-text("Preview changes")');
    
    // Wait for modal
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5000 });
    
    // Should show "Setup incomplete" or similar failure indicator
    await expect(modal.locator('text=Setup incomplete')).toBeVisible({ timeout: 5000 });
    
    // Should show "Needs attention" category (use test-id to be specific)
    await expect(modal.locator('[data-testid="filter-needs-attention"]')).toBeVisible();
    
    // Should NOT show "Your computer is ready"
    await expect(modal.locator('text=Your computer is ready')).not.toBeVisible();
  });
});
