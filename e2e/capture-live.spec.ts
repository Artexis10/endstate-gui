import { test, expect } from '@playwright/test';
import { forceAdvancedMode, goToCapturePage } from './helpers/ui-mode';

test.describe('Capture Live Progress', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    // Force Advanced mode for sidebar navigation tests
    await forceAdvancedMode(page);

    await page.addInitScript(() => {
      // Mock Tauri FIRST (mock-first approach)
      (window as any).__TAURI__ = {
        core: {
          invoke: async (cmd: string, args?: any) => {
            if (cmd === 'ensure_dir') return null;
            if (cmd === 'read_dir') return [];
            if (cmd === 'list_manifest_files') return [];
            if (cmd === 'get_default_profiles_directory') return 'C:\\test\\profiles';
            return null;
          }
        }
      };
      
      // Mock engine with streaming capture
      (window as any).__ENDSTATE_MOCK_ENGINE__ = {
        runEndstateStreaming: async (settings: any, command: string, args: string[], onEvent: Function) => {
          if (command === 'capabilities') {
            return { exitCode: 0, envelope: { success: true, data: { commands: ['capture', 'apply', 'verify', 'report'] } } };
          }
          if (command === 'report') {
            return { exitCode: 0, envelope: { success: true, data: { hasState: false } } };
          }
          if (command === 'verify') {
            return { exitCode: 0, envelope: { success: true, data: { summary: { total: 0, missingCount: 0, versionMismatchCount: 0 }, results: [] } } };
          }
          if (command === 'capture') {
            // Emit streaming events with delays
            const lines = [
              '[OK] Discord.Discord (driver: winget)',
              '[OK] Google.Chrome (driver: winget)',
              '[SKIP] Old.App (driver: chocolatey)',
              '[OK]     Manifest saved: C:\\test\\setup.jsonc',
              'Summary: 2 succeeded, 1 skipped, 0 failed',
            ];
            
            // Wait for all events to be emitted before returning
            for (const line of lines) {
              await new Promise(r => setTimeout(r, 200));
              onEvent({ type: 'stdout', data: line + '\n' });
            }
            
            // Return envelope with counts and appsIncluded - this is the source of truth
            return { 
              exitCode: 0, 
              envelope: { 
                success: true, 
                data: { 
                  outputPath: 'C:\\test\\setup.jsonc',
                  counts: {
                    totalFound: 4,
                    included: 3,
                    skipped: 1,
                    filteredRuntimes: 0,
                    filteredStoreApps: 0,
                    sensitiveExcludedCount: 0
                  },
                  appsIncluded: [
                    { id: 'Discord.Discord', source: 'winget' },
                    { id: 'Google.Chrome', source: 'winget' },
                    { id: '7zip.7zip', source: 'winget' }
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
  });

  test('Shows live per-app progress in Activity during capture', async ({ page }) => {
    // Navigate to Capture page
    await goToCapturePage(page);
    
    // Click Capture button
    await page.click('main >> button:has-text("Capture computer")');
    
    // Assert Activity card appears
    await expect(page.locator('[data-testid="activity-card"]')).toBeVisible({ timeout: 3000 });
    
    // Assert live progress shows "Processing: Discord.Discord" in Activity card
    await expect(page.locator('text=Processing:')).toBeVisible({ timeout: 2000 });
    await expect(page.locator('span.font-medium:has-text("Processing:")').locator('xpath=..')).toContainText('Discord.Discord', { timeout: 2000 });
    
    // Assert processedCount appears (shows "1 processed", "2 processed", etc.)
    await expect(page.locator('text=processed')).toBeVisible({ timeout: 2000 });
    
    // Assert capture completes with modal
    await expect(page.locator('text=Profile created')).toBeVisible({ timeout: 6000 });
  });

  test('Capture modal shows correct app count and list from envelope', async ({ page }) => {
    // Navigate to Capture page
    await goToCapturePage(page);
    
    // Click Capture button
    await page.click('main >> button:has-text("Capture computer")');
    
    // Wait for capture to complete and modal to appear
    await expect(page.locator('text=Profile created')).toBeVisible({ timeout: 6000 });
    
    // CRITICAL ASSERTIONS - These would fail with the old "0 apps" bug:
    
    // 1. Assert the count shows 3 (from envelope.data.counts.included), NOT 0
    const modalContent = page.locator('[role="dialog"]');
    const countElement = modalContent.locator('.text-success.text-2xl');
    await expect(countElement).toHaveText('3');
    
    // 2. Click to expand the details section
    await modalContent.locator('button:has-text("Details")').click();
    
    // 3. Expand the winget source group
    await modalContent.locator('button:has-text("winget")').click();
    
    // 4. Assert the app list contains expected IDs from envelope.data.appsIncluded
    await expect(modalContent.locator('span.font-mono:has-text("Discord.Discord")')).toBeVisible();
    await expect(modalContent.locator('span.font-mono:has-text("Google.Chrome")')).toBeVisible();
    await expect(modalContent.locator('span.font-mono:has-text("7zip.7zip")')).toBeVisible();
  });

  test('Technical details is closed by default and shows continuous log when opened', async ({ page }) => {
    // Navigate to Capture page
    await goToCapturePage(page);
    
    // Click Capture button
    await page.click('main >> button:has-text("Capture computer")');
    
    // Wait for Activity to appear
    await expect(page.locator('[data-testid="activity-card"]')).toBeVisible({ timeout: 3000 });
    
    // Wait for capture to complete
    await expect(page.locator('text=Profile created')).toBeVisible({ timeout: 6000 });
    
    // Close the modal
    await page.click('button:has-text("Close")');
    
    // Wait a moment for logs to be fully rendered
    await page.waitForTimeout(200);
    
    // Assert Technical details exists
    const technicalDetails = page.locator('summary:has-text("Technical details")');
    await expect(technicalDetails).toBeVisible({ timeout: 2000 });
    
    // Assert it's closed by default
    const detailsElement = page.locator('details:has(summary:has-text("Technical details"))');
    const isOpenBefore = await detailsElement.evaluate((el: HTMLDetailsElement) => el.open);
    expect(isOpenBefore).toBe(false);
    
    // Expand Technical details
    await technicalDetails.click();
    const isOpenAfter = await detailsElement.evaluate((el: HTMLDetailsElement) => el.open);
    expect(isOpenAfter).toBe(true);
    
    // Assert continuous log contains multiple app lines in the pre element
    const logPre = page.locator('details:has(summary:has-text("Technical details")) pre');
    await expect(logPre).toContainText('Discord.Discord');
    await expect(logPre).toContainText('Google.Chrome');
    await expect(logPre).toContainText('Old.App');
    await expect(logPre).toContainText('Summary:');
  });
});
