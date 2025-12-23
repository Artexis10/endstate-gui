import { test, expect } from '@playwright/test';

test.describe('Capture Live Progress', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await page.addInitScript(() => {
      // Mock engine with streaming capture
      (window as any).__AUTOSUITE_MOCK_ENGINE__ = {
        runAutosuiteStreaming: async (settings: any, command: string, args: string[], onEvent: Function) => {
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
            // Emit streaming events asynchronously
            const lines = [
              '[OK] Discord.Discord (driver: winget)',
              '[OK] Google.Chrome (driver: winget)',
              '[SKIP] Old.App (driver: chocolatey)',
              '[OK]     Manifest saved: C:\\test\\setup.jsonc',
              'Summary: 2 succeeded, 1 skipped, 0 failed',
              '{"data":{"outputPath":"C:\\\\test\\\\setup.jsonc"}}'
            ];
            
            // Emit events with delays
            (async () => {
              for (const line of lines) {
                await new Promise(r => setTimeout(r, 150));
                onEvent({ type: 'stdout', data: line + '\n' });
              }
            })();
            
            return { exitCode: 0, envelope: { success: true, data: { outputPath: 'C:\\test\\setup.jsonc' } } };
          }
          return { exitCode: 0, envelope: { success: true, data: {} } };
        }
      };
      
      // Mock Tauri for web environment
      (window as any).__TAURI__ = {
        core: {
          invoke: async (cmd: string, args?: any) => {
            if (cmd === 'ensure_dir') return null;
            if (cmd === 'read_dir') return [];
            if (cmd === 'get_default_profiles_directory') return 'C:\\test\\profiles';
            return null;
          }
        }
      };
    });
    
    await page.goto(baseURL || '/');
    await page.waitForSelector('text=Apply', { timeout: 10000 });
  });

  test('Shows live per-app progress in Activity during capture', async ({ page }) => {
    // Navigate to Capture page
    await page.click('text=Capture machine');
    await expect(page.locator('h1:has-text("Capture machine")')).toBeVisible();
    
    // Listen for console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('Browser console error:', msg.text());
      }
    });
    
    // Click Capture button
    await page.click('main >> button:has-text("Capture machine")');
    
    // Wait a moment for state to update
    await page.waitForTimeout(500);
    
    // Assert Activity card appears
    await expect(page.locator('text=Activity')).toBeVisible({ timeout: 3000 });
    
    // Assert live progress shows "Processing: Discord.Discord"
    await expect(page.locator('text=Processing:')).toBeVisible({ timeout: 1000 });
    await expect(page.locator('text=Discord.Discord')).toBeVisible({ timeout: 2000 });
    
    // Assert processedCount appears
    await expect(page.locator('text=processed')).toBeVisible({ timeout: 2000 });
    
    // Assert capture completes with modal
    await expect(page.locator('text=Capture Results')).toBeVisible({ timeout: 3000 });
  });

  test('Technical details is closed by default and shows continuous log when opened', async ({ page }) => {
    // Navigate to Capture page
    await page.click('text=Capture machine');
    await expect(page.locator('h1:has-text("Capture machine")')).toBeVisible();
    
    // Click Capture button
    await page.click('main >> button:has-text("Capture machine")');
    
    // Wait for Activity to appear
    await expect(page.locator('text=Activity')).toBeVisible({ timeout: 2000 });
    
    // Assert Technical details exists
    const technicalDetails = page.locator('summary:has-text("Technical details")');
    await expect(technicalDetails).toBeVisible({ timeout: 2000 });
    
    // Assert it's closed by default
    const detailsElement = page.locator('details:has(summary:has-text("Technical details"))');
    const isOpenBefore = await detailsElement.evaluate((el: HTMLDetailsElement) => el.open);
    expect(isOpenBefore).toBe(false);
    
    // Wait for capture to complete
    await expect(page.locator('text=Capture Results')).toBeVisible({ timeout: 3000 });
    
    // Expand Technical details
    await technicalDetails.click();
    const isOpenAfter = await detailsElement.evaluate((el: HTMLDetailsElement) => el.open);
    expect(isOpenAfter).toBe(true);
    
    // Assert continuous log contains multiple app lines
    const logContent = page.locator('details:has(summary:has-text("Technical details"))');
    await expect(logContent).toContainText('Discord.Discord');
    await expect(logContent).toContainText('Google.Chrome');
    await expect(logContent).toContainText('Old.App');
    await expect(logContent).toContainText('Summary:');
  });
});
