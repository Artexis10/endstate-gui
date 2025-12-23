import { test, expect } from '@playwright/test';

test.describe('UX Contract Tests', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await page.addInitScript(() => {
      // Mock Tauri APIs for web-only testing
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
      
      // Mock engine for streaming operations
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
          return { exitCode: 0, envelope: { success: true, data: {} } };
        }
      };
    });
    await page.goto(baseURL || '/');
    await page.waitForSelector('text=Apply', { timeout: 10000 });
  });

  test('Boot does not hang - reaches ready state within timeout', async ({ page }) => {
    // This test verifies the app boots successfully and doesn't hang at "Loading..."
    // The beforeEach already waits for 'Apply' to be visible, which means boot completed
    await expect(page.locator('h1:has-text("Apply")')).toBeVisible();
    
    // Verify we're NOT stuck on loading screen
    await expect(page.locator('text=Loading...')).not.toBeVisible();
    await expect(page.locator('text=Running: autosuite capabilities')).not.toBeVisible();
  });

  test('Navigation works without breaking', async ({ page }) => {
    await page.click('text=Capture machine');
    await expect(page.locator('h1:has-text("Capture machine")')).toBeVisible();
    await page.click('text=Apply');
    await expect(page.locator('h1:has-text("Apply")')).toBeVisible();
    await page.click('text=Capture machine');
    await expect(page.locator('main >> button:has-text("Capture machine")')).toBeVisible();
  });

  test('Last Run persists', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('autosuite-last-run', JSON.stringify({ timestamp: new Date().toISOString(), command: 'capture', outcome: { succeeded: 10, skipped: 2, failed: 0 } }));
    });
    await page.reload();
    await page.waitForTimeout(1000);
    const exists = await page.evaluate(() => localStorage.getItem('autosuite-last-run') !== null);
    expect(exists).toBe(true);
  });
});
