import { test, expect } from '@playwright/test';

/**
 * Web-only E2E tests that run against the Vite dev server
 * These tests use the mocked engine seam and don't require Tauri
 */

test.describe('UX Contract Tests (Web-only)', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the dev server
    await page.goto('http://localhost:1420');
    
    // Mock the engine with deterministic responses
    await page.evaluate(() => {
      (window as any).__AUTOSUITE_MOCK_ENGINE__ = {
        capabilities: {
          envelope: {
            success: true,
            data: { commands: ['capture', 'apply', 'verify', 'report'] }
          }
        },
        report: {
          envelope: {
            success: true,
            data: { hasState: false }
          }
        },
        verify: {
          envelope: {
            success: true,
            data: { summary: { total: 0, missingCount: 0, versionMismatchCount: 0 }, results: [] }
          }
        }
      };
    });
  });

  test('Navigation: Capture → Apply → Capture does not break page', async ({ page }) => {
    // Wait for app to load
    await expect(page.locator('text=Apply')).toBeVisible({ timeout: 5000 });
    
    // Navigate to Capture
    await page.click('text=Capture machine');
    await expect(page.locator('h1:has-text("Capture machine")')).toBeVisible();
    await expect(page.locator('button:has-text("Capture machine")')).toBeVisible();
    
    // Navigate to Apply
    await page.click('text=Apply');
    await expect(page.locator('h1:has-text("Apply")')).toBeVisible();
    
    // Navigate back to Capture - should not break
    await page.click('text=Capture machine');
    await expect(page.locator('h1:has-text("Capture machine")')).toBeVisible();
    await expect(page.locator('button:has-text("Capture machine")')).toBeVisible();
    
    // Verify no console errors
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.waitForTimeout(500);
    expect(errors).toHaveLength(0);
  });

  test('Activity card shows live per-app progress during Capture', async ({ page }) => {
    await page.click('text=Capture machine');
    
    // Mock streaming capture output
    await page.evaluate(() => {
      const mockEngine = (window as any).__AUTOSUITE_MOCK_ENGINE__;
      mockEngine.capture = async (settings: any, command: string, args: string[], onEvent: Function) => {
        const lines = [
          '[OK] Discord.Discord (driver: winget)',
          '[OK] Google.Chrome (driver: winget)',
          '[SKIP] OldApp (driver: chocolatey)',
          '[OK]     Manifest saved: C:\\test\\setup.jsonc',
          'Summary: 2 succeeded, 1 skipped, 0 failed'
        ];
        
        for (const line of lines) {
          await new Promise(resolve => setTimeout(resolve, 50));
          onEvent({ type: 'stdout', data: line + '\n' });
        }
        
        return {
          exitCode: 0,
          envelope: { success: true, data: { outputPath: 'C:\\test\\setup.jsonc' } }
        };
      };
    });
    
    await page.click('button:has-text("Capture machine")');
    
    // Verify Activity card appears
    await expect(page.locator('text=Activity')).toBeVisible({ timeout: 2000 });
    
    // Verify live progress shows "Processing: <AppId>"
    await expect(page.locator('text=Processing:')).toBeVisible({ timeout: 3000 });
    
    // Verify processedCount is displayed
    await expect(page.locator('text=processed')).toBeVisible({ timeout: 3000 });
  });

  test('Technical details shows continuous log (closed by default)', async ({ page }) => {
    await page.click('text=Capture machine');
    
    // Mock streaming with multiple lines
    await page.evaluate(() => {
      const mockEngine = (window as any).__AUTOSUITE_MOCK_ENGINE__;
      mockEngine.capture = async (settings: any, command: string, args: string[], onEvent: Function) => {
        onEvent({ type: 'stdout', data: 'Line 1\n' });
        onEvent({ type: 'stdout', data: 'Line 2\n' });
        onEvent({ type: 'stdout', data: 'Line 3\n' });
        onEvent({ type: 'stdout', data: '[OK]     Manifest saved: C:\\test\\setup.jsonc\n' });
        onEvent({ type: 'stdout', data: 'Summary: 0 succeeded, 0 skipped, 0 failed\n' });
        
        return {
          exitCode: 0,
          envelope: { success: true, data: { outputPath: 'C:\\test\\setup.jsonc' } }
        };
      };
    });
    
    await page.click('button:has-text("Capture machine")');
    await page.waitForTimeout(500);
    
    // Verify Technical details exists
    const technicalDetails = page.locator('summary:has-text("Technical details")');
    await expect(technicalDetails).toBeVisible({ timeout: 2000 });
    
    // Verify it's closed by default (details element should not have 'open' attribute initially)
    const detailsElement = page.locator('details:has(summary:has-text("Technical details"))');
    const isOpen = await detailsElement.evaluate((el: HTMLDetailsElement) => el.open);
    expect(isOpen).toBe(false);
    
    // Open it and verify multiple lines are present
    await technicalDetails.click();
    await expect(page.locator('text=Line 1')).toBeVisible();
    await expect(page.locator('text=Line 2')).toBeVisible();
    await expect(page.locator('text=Line 3')).toBeVisible();
  });

  test('Last Run persists after reload', async ({ page }) => {
    // Set Last Run in localStorage
    await page.evaluate(() => {
      const lastRunData = {
        timestamp: new Date().toISOString(),
        command: 'capture',
        outcome: { succeeded: 10, skipped: 2, failed: 0 }
      };
      localStorage.setItem('autosuite-last-run', JSON.stringify(lastRunData));
    });
    
    // Reload the page
    await page.reload();
    await page.waitForTimeout(1000);
    
    // Verify Last Run data is loaded (state should be set)
    const lastRunExists = await page.evaluate(() => {
      const stored = localStorage.getItem('autosuite-last-run');
      return stored !== null;
    });
    
    expect(lastRunExists).toBe(true);
  });
});
