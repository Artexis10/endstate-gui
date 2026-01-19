import { test, expect } from '@playwright/test';
import { installTauriMock } from './helpers/tauri-mock';

/**
 * Accordion Navigation Regression Test
 * 
 * Verifies that the "Set up computer" accordion card remains interactive
 * after navigating away from Overview and returning.
 * 
 * Bug scenario:
 * 1. Expand "Set up computer" card
 * 2. Click "Preview changes" (runs preview, shows result)
 * 3. Click "View details" (opens modal)
 * 4. Navigate to Report page via "View all" in Recent Activity
 * 5. Return to Overview
 * 6. Accordion should be expandable/collapsible again
 */
test.describe('Accordion Navigation Bug', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await installTauriMock(page, {
      invoke: {
        list_manifest_files: ['C:\\test\\profiles\\test-profile.jsonc'],
        validate_profile: () => ({
          valid: true,
          errors: [],
          summary: {
            name: 'test-profile',
            version: 1,
            appCount: 1,
          }
        }),
        check_file_exists: true,
        read_text_file: '{}',
      }
    });

    await page.addInitScript(() => {
      // Mock engine with preview support
      (window as any).__ENDSTATE_MOCK_ENGINE__ = {
        runEndstateStreaming: async (settings: any, command: string, args: string[], onEvent: Function) => {
          if (command === 'capabilities') {
            return { exitCode: 0, envelope: { success: true, data: { commands: ['capture', 'apply', 'report'] } } };
          }
          if (command === 'report') {
            return { exitCode: 0, envelope: { success: true, data: { hasState: false } } };
          }
          if (command === 'apply') {
            const isDryRun = args.includes('--dry-run');
            if (isDryRun) {
              // Preview response
              onEvent({ type: 'stdout', data: '[OK] Discord.Discord - already installed\n' });
              return {
                exitCode: 0,
                envelope: {
                  success: true,
                  data: {
                    dryRun: true,
                    counts: { total: 1, installed: 0, alreadyInstalled: 1, skippedFiltered: 0, failed: 0 },
                    items: [{ id: 'Discord.Discord', driver: 'winget', status: 'ok', reason: 'already_installed' }]
                  }
                }
              };
            }
            return { exitCode: 0, envelope: { success: true, data: {} } };
          }
          return { exitCode: 0, envelope: { success: true, data: {} } };
        }
      };

      // Seed lifecycle state to show Recent Activity section
      const lifecycleState = {
        lastCapture: {
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          success: true,
          summary: { total: 10 }
        }
      };
      localStorage.setItem('endstate-lifecycle-state', JSON.stringify(lifecycleState));
      
      // Seed settings with selected profile (required for Preview changes button to be enabled)
      const settings = {
        engineMode: 'path',
        engineScriptPath: '',
        customProfilesDirectory: '',
        lastSelectedProfile: 'test-profile',
        lastSelectedProfilePath: 'C:\\test\\profiles\\test-profile.jsonc',
        dryRunEnabled: false,
      };
      localStorage.setItem('endstate-gui-settings', JSON.stringify(settings));
      
      // Ensure Default UI mode (not Advanced)
      localStorage.setItem('endstate-ui-mode', 'default');
    });

    await page.goto(baseURL || '/');
    await page.waitForLoadState('networkidle');
  });

  test('Set up computer accordion remains interactive after navigation to Report and back', async ({ page }) => {
    // Wait for Overview screen to load (shows "Endstate" heading in Default mode)
    await expect(page.locator('h1:has-text("Endstate")')).toBeVisible({ timeout: 10000 });

    // Verify we're in Default mode - "Set up computer" should be a card, not a nav item
    const setupCard = page.locator('text=Set up computer').first();
    await expect(setupCard).toBeVisible();

    // Step 1: Expand "Set up computer" card by clicking it
    await setupCard.click();

    // Verify expanded content is visible - look for "Preview changes" button (the action button)
    const previewChangesBtn = page.getByRole('button', { name: 'Preview changes' });
    await expect(previewChangesBtn).toBeVisible({ timeout: 3000 });
    // Wait for button to be enabled (profile discovery may take time)
    await expect(previewChangesBtn).toBeEnabled({ timeout: 10000 });

    // Step 2: Click "Preview changes" button
    await previewChangesBtn.click();

    // Wait for preview to complete - should show success state
    await expect(page.locator('text=Completed successfully')).toBeVisible({ timeout: 5000 });

    // Step 3: Click "Details" to open modal
    await page.click('button:has-text("Details")');

    // Verify modal is open
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 3000 });

    // Close the modal (button changed from "Done" to "Close")
    await page.click('[role="dialog"] button:has-text("Close")');
    await expect(dialog).not.toBeVisible({ timeout: 3000 });

    // Step 4: Navigate to Report page via "View all" in Recent Activity
    await page.click('button:has-text("View all")');

    // Verify we're on Report page
    await expect(page.locator('h1:has-text("Report")')).toBeVisible({ timeout: 5000 });

    // Step 5: Navigate back to Overview (use Back button or nav)
    // In Default mode, there should be a Back button
    const backButton = page.locator('button:has-text("Back")');
    if (await backButton.isVisible()) {
      await backButton.click();
    } else {
      // Fallback: use browser back or navigate via other means
      await page.goBack();
    }

    // Verify we're back on Overview
    await expect(page.locator('h1:has-text("Endstate")')).toBeVisible({ timeout: 5000 });

    // Step 6: Verify accordion is interactive - the success result should still be showing
    // This tests that action results persist across navigation (correct behavior)
    const setupCardAfterNav = page.locator('[data-testid="overview-card-apply"]');
    await expect(setupCardAfterNav).toBeVisible();
    
    // Expand the card
    await setupCardAfterNav.click();
    await expect(page.locator('[data-testid="setup-card-expanded-content"]')).toBeVisible();
    
    // Verify the success result is still showing (action results persist across navigation)
    await expect(page.locator('text=Completed successfully')).toBeVisible({ timeout: 3000 });
    
    // Verify result controls are present (Details, Dismiss, Apply changes buttons)
    await expect(page.getByRole('button', { name: 'Details' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dismiss' })).toBeVisible();
    
    // Test passes - accordion is interactive and result persists after navigation
  });

  test('Accordion state resets properly when navigating away during action result', async ({ page }) => {
    // Wait for Overview screen
    await expect(page.locator('h1:has-text("Endstate")')).toBeVisible({ timeout: 10000 });

    // Expand "Set up computer" card
    const setupCard = page.locator('text=Set up computer').first();
    await setupCard.click();
    const previewChangesBtn = page.getByRole('button', { name: 'Preview changes' });
    await expect(previewChangesBtn).toBeVisible({ timeout: 3000 });
    // Wait for button to be enabled (profile discovery may take time)
    await expect(previewChangesBtn).toBeEnabled({ timeout: 10000 });

    // Run preview
    await previewChangesBtn.click();
    await expect(page.locator('text=Completed successfully')).toBeVisible({ timeout: 5000 });

    // Navigate away while result is showing (without dismissing)
    await page.click('button:has-text("View all")');
    await expect(page.locator('h1:has-text("Report")')).toBeVisible({ timeout: 5000 });

    // Navigate back
    const backButton = page.locator('button:has-text("Back")');
    if (await backButton.isVisible()) {
      await backButton.click();
    } else {
      await page.goBack();
    }

    // Verify Overview is shown
    await expect(page.locator('h1:has-text("Endstate")')).toBeVisible({ timeout: 5000 });

    // Card should be interactive - the success result should still be showing
    const setupCardAfterNav = page.locator('[data-testid="overview-card-apply"]');
    await expect(setupCardAfterNav).toBeVisible();
    
    // Expand the card
    await setupCardAfterNav.click();
    await expect(page.locator('[data-testid="setup-card-expanded-content"]')).toBeVisible();
    
    // Verify the success result is still showing (action results persist across navigation)
    await expect(page.locator('text=Completed successfully')).toBeVisible({ timeout: 3000 });
    
    // Verify result controls are present
    await expect(page.getByRole('button', { name: 'Details' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dismiss' })).toBeVisible();
    
    // Test passes - accordion state persists correctly after navigation
  });
});
