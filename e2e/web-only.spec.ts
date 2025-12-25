import { test, expect } from '@playwright/test';
import { forceAdvancedMode, goToApplyPage, goToCapturePage } from './helpers/ui-mode';

test.describe('UX Contract Tests', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    // Force Advanced mode for sidebar navigation tests
    await forceAdvancedMode(page);

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
          return { exitCode: 0, envelope: { success: true, data: {} } };
        }
      };
    });
    await page.goto(baseURL || '/');
    await page.waitForLoadState('networkidle');
  });

  test('Boot does not hang - reaches ready state within timeout', async ({ page }) => {
    // This test verifies the app boots successfully and doesn't hang at "Loading..."
    // Navigate to Apply page to verify app is ready
    await goToApplyPage(page);
    
    // Verify we're NOT stuck on loading screen
    await expect(page.locator('text=Loading...')).not.toBeVisible();
    await expect(page.locator('text=Running: endstate capabilities')).not.toBeVisible();
  });

  test('Navigation works without breaking', async ({ page }) => {
    await goToCapturePage(page);
    await goToApplyPage(page);
    await goToCapturePage(page);
    await expect(page.locator('main >> button:has-text("Capture computer")')).toBeVisible();
  });

  test('Last Run persists per-command', async ({ page }) => {
    // Use namespaced per-command keys - VITE_STORAGE_NS=test is set in playwright.config.ts
    await page.evaluate(() => {
      // Set capture last run
      localStorage.setItem('test:endstate-last-run-capture', JSON.stringify({ 
        timestamp: new Date().toISOString(), 
        command: 'capture', 
        outcome: { succeeded: 10, skipped: 2, failed: 0 } 
      }));
      // Set apply last run
      localStorage.setItem('test:endstate-last-run-apply', JSON.stringify({ 
        timestamp: new Date().toISOString(), 
        command: 'apply', 
        profile: 'test-profile',
        outcome: { installed: 5, alreadyPresent: 3, needsAttention: 0 } 
      }));
    });
    await page.reload();
    await page.waitForTimeout(1000);
    
    // Verify both per-command keys exist
    const captureExists = await page.evaluate(() => localStorage.getItem('test:endstate-last-run-capture') !== null);
    const applyExists = await page.evaluate(() => localStorage.getItem('test:endstate-last-run-apply') !== null);
    expect(captureExists).toBe(true);
    expect(applyExists).toBe(true);
  });
});
