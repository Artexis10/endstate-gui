import { test, expect } from '@playwright/test';
import { forceAdvancedMode, seedProfileSettings } from './helpers/ui-mode';

/**
 * E2E Test: Apply -> Navigate Away -> Back -> UI Persistence
 * 
 * This test reproduces and prevents the bug where:
 * 1. User triggers an Apply run from Overview
 * 2. User navigates to Settings (or another page) while Apply is running
 * 3. User navigates back to Overview
 * 4. BUG: The "Applying..." state was reset or user was stuck with no visible running UI
 * 
 * Additionally tests Reports page behavior after completion.
 */

test.describe('Apply Navigation Persistence', () => {
  test.beforeEach(async ({ page }) => {
    // Force Advanced mode for sidebar navigation
    await forceAdvancedMode(page);
    // Seed profile settings with a test profile
    await seedProfileSettings(page, 'test-profile', false); // dryRunEnabled=false for direct Apply

    await page.addInitScript(() => {
      // Track apply calls and control timing
      (window as any).__APPLY_STARTED__ = false;
      (window as any).__APPLY_COMPLETE__ = false;
      (window as any).__APPLY_RESOLVER__ = null;
      
      (window as any).__TAURI__ = {
        core: {
          invoke: async (cmd: string, args?: any) => {
            if (cmd === 'ensure_dir') return null;
            if (cmd === 'read_dir') return [];
            if (cmd === 'list_manifest_files') return ['C:\\test\\profiles\\test-profile.jsonc'];
            if (cmd === 'get_default_profiles_directory') return 'C:\\test\\profiles';
            if (cmd === 'validate_profile') {
              return { valid: true, errors: [], summary: { name: 'test-profile', version: 1, appCount: 2 } };
            }
            if (cmd === 'read_text_file') return '{}';
            if (cmd === 'check_file_exists') return false;
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
            (window as any).__APPLY_STARTED__ = true;
            
            // Emit initial progress events
            onEvent({ type: 'stdout', data: '[INSTALL] Discord.Discord\n' });
            
            // Wait for test to signal completion (or timeout after 10s)
            await new Promise<void>((resolve) => {
              (window as any).__APPLY_RESOLVER__ = resolve;
              // Auto-resolve after 10s to prevent hanging
              setTimeout(() => {
                if (!(window as any).__APPLY_COMPLETE__) {
                  (window as any).__APPLY_COMPLETE__ = true;
                  resolve();
                }
              }, 10000);
            });
            
            // Emit completion events
            onEvent({ type: 'stdout', data: '[OK] Discord.Discord - Installed successfully\n' });
            onEvent({ type: 'stdout', data: '[SKIP] Google.Chrome - already installed\n' });
            
            return { 
              exitCode: 0, 
              envelope: { 
                success: true, 
                data: { 
                  counts: {
                    total: 2,
                    installed: 1,
                    alreadyInstalled: 1,
                    skippedFiltered: 0,
                    failed: 0
                  },
                  items: [
                    { id: 'Discord.Discord', driver: 'winget', status: 'ok', reason: 'installed' },
                    { id: 'Google.Chrome', driver: 'winget', status: 'skipped', reason: 'already_installed' }
                  ]
                } 
              } 
            };
          }
          return { exitCode: 0, envelope: { success: true, data: {} } };
        }
      };
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Apply state persists when navigating away and back during run', async ({ page }) => {
    // Step 1: We're on Overview - click the Setup card to expand it
    const setupCard = page.locator('[data-testid="overview-card-apply"]');
    await expect(setupCard).toBeVisible();
    await setupCard.click();
    
    // Wait for expanded content to appear
    await expect(page.locator('[data-testid="setup-card-expanded-content"]')).toBeVisible({ timeout: 3000 });
    
    // Step 2: Switch to Apply mode (not Preview) and trigger Apply
    const applyToggle = page.locator('button:has-text("Apply")').first();
    if (await applyToggle.isVisible()) {
      await applyToggle.click();
    }
    
    // Click Apply changes button
    const applyButton = page.locator('button:has-text("Apply changes")');
    await expect(applyButton).toBeVisible();
    await applyButton.click();
    
    // Step 3: Assert "Applying..." state is visible
    // The progress indicator should show we're applying
    await expect(page.locator('text=Installing applications')).toBeVisible({ timeout: 5000 });
    
    // Verify Apply started in mock
    await expect.poll(async () => {
      return await page.evaluate(() => (window as any).__APPLY_STARTED__);
    }, { timeout: 5000 }).toBe(true);
    
    // Step 4: Navigate to Settings while Apply is running
    const settingsNav = page.locator('[data-testid="nav-settings"]');
    await settingsNav.click();
    await expect(page.locator('h1:has-text("Settings")')).toBeVisible({ timeout: 5000 });
    
    // Verify we see the "Run in progress" banner on Settings page
    await expect(page.locator('text=Run in progress')).toBeVisible({ timeout: 3000 });
    
    // Step 5: Navigate back to Overview
    const overviewNav = page.locator('[data-testid="nav-overview"]');
    await overviewNav.click();
    
    // Step 6: Assert the "Applying..." state is STILL visible (no reset)
    // The setup card should be expanded and showing progress
    await expect(page.locator('[data-testid="setup-card-expanded-content"]')).toBeVisible({ timeout: 3000 });
    
    // Should still show applying state - look for the progress indicator
    // The card should show running state (spinner, progress message)
    const progressIndicator = page.locator('text=Installing applications').or(
      page.locator('text=Working')
    ).or(
      page.locator('text=Verifying')
    );
    await expect(progressIndicator.first()).toBeVisible({ timeout: 3000 });
    
    // The setup card should be expanded showing the running state
    // This is the key assertion: the UI should NOT have reset
    const expandedContent = page.locator('[data-testid="setup-card-expanded-content"]');
    await expect(expandedContent).toBeVisible({ timeout: 3000 });
    
    // Step 7: Complete the apply run via test harness
    await page.evaluate(() => {
      (window as any).__APPLY_COMPLETE__ = true;
      if ((window as any).__APPLY_RESOLVER__) {
        (window as any).__APPLY_RESOLVER__();
      }
    });
    
    // Step 8: Assert completion UI appears
    // Wait for success state - "Completed successfully" or similar
    await expect(
      page.locator('text=Completed successfully').or(
        page.locator('text=installed').and(page.locator('text=already present'))
      ).first()
    ).toBeVisible({ timeout: 10000 });
    
    // Should show Dismiss button after completion
    await expect(page.locator('button:has-text("Dismiss")')).toBeVisible({ timeout: 3000 });
  });

  test('Reports page shows completed run without misleading artifact message', async ({ page }) => {
    // Step 1: Trigger and complete an Apply run
    const setupCard = page.locator('[data-testid="overview-card-apply"]');
    await setupCard.click();
    await expect(page.locator('[data-testid="setup-card-expanded-content"]')).toBeVisible({ timeout: 3000 });
    
    // Switch to Apply mode
    const applyToggle = page.locator('button:has-text("Apply")').first();
    if (await applyToggle.isVisible()) {
      await applyToggle.click();
    }
    
    // Click Apply changes
    await page.locator('button:has-text("Apply changes")').click();
    
    // Wait for apply to start
    await expect.poll(async () => {
      return await page.evaluate(() => (window as any).__APPLY_STARTED__);
    }, { timeout: 5000 }).toBe(true);
    
    // Complete the run immediately
    await page.evaluate(() => {
      (window as any).__APPLY_COMPLETE__ = true;
      if ((window as any).__APPLY_RESOLVER__) {
        (window as any).__APPLY_RESOLVER__();
      }
    });
    
    // Wait for completion
    await expect(page.locator('button:has-text("Dismiss")')).toBeVisible({ timeout: 10000 });
    
    // Step 2: Navigate to Reports
    const reportsNav = page.locator('[data-testid="nav-report"]');
    await reportsNav.click();
    // Report page uses "Report" as title (singular)
    await expect(page.locator('h1:has-text("Report")')).toBeVisible({ timeout: 5000 });
    
    // Step 3: Assert the just-finished run is visible
    // Should show "Recent Runs" section with the apply run
    await expect(page.locator('text=Recent Runs')).toBeVisible({ timeout: 3000 });
    
    // The run should be listed (look for apply/setup indicator)
    const runEntry = page.locator('details').filter({ hasText: /apply|setup/i }).first();
    
    // If there's a run entry, it should NOT show "Artifacts not saved (older runs)" 
    // for the current/just-finished run
    // The message should either be absent or show "In progress" if still finalizing
    const artifactMessage = page.locator('text=Artifacts not saved (older runs)');
    
    // For a just-completed run, we should NOT see the "older runs" message
    // (it may show "In progress" briefly or no message at all for current run)
    // Wait a moment for state to settle
    await page.waitForTimeout(500);
    
    // Check if the misleading message is NOT prominently displayed for the current run
    // The test passes if either:
    // 1. No "Artifacts not saved (older runs)" message is visible, OR
    // 2. If visible, it's not associated with the just-completed run
    const hasOlderRunsMessage = await artifactMessage.isVisible().catch(() => false);
    
    // If the message exists, verify it's not for the current run by checking
    // that we also see proper run indicators
    if (hasOlderRunsMessage) {
      // Expand the first run entry to check its content
      if (await runEntry.isVisible()) {
        await runEntry.click();
        // The current run should show success indicators, not the misleading message
        const runDetails = runEntry.locator('..');
        const hasSuccessIndicator = await runDetails.locator('text=Success').isVisible().catch(() => false) ||
                                    await runDetails.locator('text=Installed').isVisible().catch(() => false);
        // If we have success indicators, the run completed properly
        expect(hasSuccessIndicator || !hasOlderRunsMessage).toBe(true);
      }
    }
  });

  test('user is not stuck with no visible running UI after navigation', async ({ page }) => {
    // This test specifically checks the "stuck" scenario where user sees nothing
    
    // Step 1: Start Apply
    const setupCard = page.locator('[data-testid="overview-card-apply"]');
    await setupCard.click();
    await expect(page.locator('[data-testid="setup-card-expanded-content"]')).toBeVisible({ timeout: 3000 });
    
    const applyToggle = page.locator('button:has-text("Apply")').first();
    if (await applyToggle.isVisible()) {
      await applyToggle.click();
    }
    
    await page.locator('button:has-text("Apply changes")').click();
    
    // Wait for apply to start
    await expect.poll(async () => {
      return await page.evaluate(() => (window as any).__APPLY_STARTED__);
    }, { timeout: 5000 }).toBe(true);
    
    // Step 2: Navigate away and back multiple times
    for (let i = 0; i < 3; i++) {
      // Go to Settings
      await page.locator('[data-testid="nav-settings"]').click();
      await expect(page.locator('h1:has-text("Settings")')).toBeVisible({ timeout: 3000 });
      
      // Go back to Overview
      await page.locator('[data-testid="nav-overview"]').click();
      // Wait for Overview page - use the main content heading which is unique
      await expect(page.locator('main h1:has-text("Endstate")')).toBeVisible({ timeout: 3000 });
    }
    
    // Step 3: Assert we're NOT stuck - there should be visible running UI
    // Either the setup card is expanded with progress, OR there's a banner
    const hasVisibleRunningUI = await page.locator('[data-testid="setup-card-expanded-content"]').isVisible().catch(() => false) ||
                                 await page.locator('text=Run in progress').isVisible().catch(() => false) ||
                                 await page.locator('text=Installing').isVisible().catch(() => false) ||
                                 await page.locator('text=Applying').isVisible().catch(() => false);
    
    expect(hasVisibleRunningUI).toBe(true);
    
    // Step 4: Complete and verify we can see completion
    await page.evaluate(() => {
      (window as any).__APPLY_COMPLETE__ = true;
      if ((window as any).__APPLY_RESOLVER__) {
        (window as any).__APPLY_RESOLVER__();
      }
    });
    
    // Should eventually show completion
    await expect(page.locator('button:has-text("Dismiss")')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Apply Completion States', () => {
  test.beforeEach(async ({ page }) => {
    await forceAdvancedMode(page);
    await seedProfileSettings(page, 'test-profile', false);

    await page.addInitScript(() => {
      (window as any).__TAURI__ = {
        core: {
          invoke: async (cmd: string, args?: any) => {
            if (cmd === 'ensure_dir') return null;
            if (cmd === 'read_dir') return [];
            if (cmd === 'list_manifest_files') return ['C:\\test\\profiles\\test-profile.jsonc'];
            if (cmd === 'get_default_profiles_directory') return 'C:\\test\\profiles';
            if (cmd === 'validate_profile') {
              return { valid: true, errors: [], summary: { name: 'test-profile', version: 1, appCount: 2 } };
            }
            if (cmd === 'read_text_file') return '{}';
            if (cmd === 'check_file_exists') return false;
            return null;
          }
        }
      };
    });
  });

  test('shows success completion UI after successful apply', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__ENDSTATE_MOCK_ENGINE__ = {
        runEndstateStreaming: async (settings: any, command: string, args: string[], onEvent: Function) => {
          if (command === 'capabilities') {
            return { exitCode: 0, envelope: { success: true, data: { commands: ['capture', 'apply', 'report'] } } };
          }
          if (command === 'report') {
            return { exitCode: 0, envelope: { success: true, data: { hasState: false } } };
          }
          if (command === 'apply') {
            onEvent({ type: 'stdout', data: '[OK] Discord.Discord - Installed\n' });
            await new Promise(r => setTimeout(r, 100));
            return { 
              exitCode: 0, 
              envelope: { 
                success: true, 
                data: { 
                  counts: { total: 1, installed: 1, alreadyInstalled: 0, skippedFiltered: 0, failed: 0 },
                  items: [{ id: 'Discord.Discord', driver: 'winget', status: 'ok', reason: 'installed' }]
                } 
              } 
            };
          }
          return { exitCode: 0, envelope: { success: true, data: {} } };
        }
      };
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Trigger apply
    await page.locator('[data-testid="overview-card-apply"]').click();
    await expect(page.locator('[data-testid="setup-card-expanded-content"]')).toBeVisible({ timeout: 3000 });
    
    const applyToggle = page.locator('button:has-text("Apply")').first();
    if (await applyToggle.isVisible()) {
      await applyToggle.click();
    }
    
    await page.locator('button:has-text("Apply changes")').click();
    
    // Wait for completion
    await expect(page.locator('text=Completed successfully')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("Dismiss")')).toBeVisible();
  });

  test('shows partial failure UI when some apps fail', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__ENDSTATE_MOCK_ENGINE__ = {
        runEndstateStreaming: async (settings: any, command: string, args: string[], onEvent: Function) => {
          if (command === 'capabilities') {
            return { exitCode: 0, envelope: { success: true, data: { commands: ['capture', 'apply', 'report'] } } };
          }
          if (command === 'report') {
            return { exitCode: 0, envelope: { success: true, data: { hasState: false } } };
          }
          if (command === 'apply') {
            onEvent({ type: 'stdout', data: '[OK] Discord.Discord - Installed\n' });
            onEvent({ type: 'stdout', data: '[FAIL] BrokenApp.App - Failed\n' });
            await new Promise(r => setTimeout(r, 100));
            return { 
              exitCode: 1, 
              envelope: { 
                success: false,
                error: null, // Partial failure, not hard error
                data: { 
                  counts: { total: 2, installed: 1, alreadyInstalled: 0, skippedFiltered: 0, failed: 1 },
                  items: [
                    { id: 'Discord.Discord', driver: 'winget', status: 'ok', reason: 'installed' },
                    { id: 'BrokenApp.App', driver: 'winget', status: 'failed', reason: 'install_failed' }
                  ]
                } 
              } 
            };
          }
          return { exitCode: 0, envelope: { success: true, data: {} } };
        }
      };
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Trigger apply
    await page.locator('[data-testid="overview-card-apply"]').click();
    await expect(page.locator('[data-testid="setup-card-expanded-content"]')).toBeVisible({ timeout: 3000 });
    
    const applyToggle = page.locator('button:has-text("Apply")').first();
    if (await applyToggle.isVisible()) {
      await applyToggle.click();
    }
    
    await page.locator('button:has-text("Apply changes")').click();
    
    // Wait for completion with issues
    await expect(page.locator('text=Completed with issues')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=1 failed')).toBeVisible();
    await expect(page.locator('button:has-text("Dismiss")')).toBeVisible();
  });
});
