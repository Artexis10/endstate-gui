import { test, expect } from '@playwright/test';
import { forceAdvancedMode, goToApplyPage, goToCapturePage, goToVerifyPage } from './helpers/ui-mode';

/**
 * Navigation Smoke Test
 * 
 * Verifies basic navigation between all pages works correctly.
 * Does NOT depend on profiles, preview, or any operation execution.
 * Only checks stable landmarks (page headings) exist after navigation.
 * 
 * NOTE: These tests require Advanced mode (sidebar navigation visible).
 * App always starts on Overview; tests navigate explicitly.
 */

test.describe('Navigation Smoke', () => {
  test.beforeEach(async ({ page }) => {
    // Force Advanced mode for sidebar navigation tests
    await forceAdvancedMode(page);

    // Mock Tauri bridge
    await page.addInitScript(() => {
      (window as any).__TAURI__ = {
        core: {
          invoke: async (cmd: string) => {
            if (cmd === 'ensure_dir') return null;
            if (cmd === 'read_dir') return [];
            if (cmd === 'list_manifest_files') return [];
            if (cmd === 'get_default_profiles_directory') return 'C:\\test\\profiles';
            return null;
          }
        }
      };
    });

    // Mock endstate engine
    await page.addInitScript(() => {
      (window as any).__ENDSTATE_MOCK_ENGINE__ = {
        runEndstateStreaming: async (settings: any, command: string, args: string[], onEvent: Function) => {
          if (command === 'capabilities') {
            return {
              exitCode: 0,
              envelope: {
                success: true,
                data: {
                  version: '1.0.0',
                  drivers: ['winget', 'scoop'],
                  features: []
                }
              }
            };
          }
          return { exitCode: 0, envelope: { success: true, data: {} } };
        }
      };
    });

    // Listen for console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        // Whitelist known benign errors
        const text = msg.text();
        
        // React StrictMode double-render warnings are benign
        if (text.includes('Warning: ReactDOM.render')) return;
        if (text.includes('act(...)')) return;
        
        // Fail on unexpected console errors
        throw new Error(`Console error: ${text}`);
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('navigates through all pages and verifies stable landmarks', async ({ page }) => {
    // App starts on Overview - navigate to Apply first
    await goToApplyPage(page);
    
    // Navigate to Capture
    await goToCapturePage(page);
    
    // Navigate to Verify (Check computer)
    await goToVerifyPage(page);
    
    // Navigate to Settings
    await page.locator('nav >> button:has-text("Settings")').click();
    await expect(page.locator('h1:has-text("Settings")')).toBeVisible({ timeout: 5000 });
    
    // Navigate back to Apply (Set up computer)
    await goToApplyPage(page);
  });

  test('each page has unique stable heading', async ({ page }) => {
    // App starts on Overview - navigate to Apply first
    await goToApplyPage(page);
    
    // Capture page
    await goToCapturePage(page);
    await expect(page.locator('h1:has-text("Set up computer")')).not.toBeVisible();
    
    // Verify page
    await goToVerifyPage(page);
    await expect(page.locator('h1:has-text("Capture computer")')).not.toBeVisible();
    
    // Settings page
    await page.locator('nav >> button:has-text("Settings")').click();
    await expect(page.locator('h1:has-text("Settings")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('h1:has-text("Check computer")')).not.toBeVisible();
  });

  test('navigation preserves app state (no crashes)', async ({ page }) => {
    // Navigate through all pages multiple times
    for (let i = 0; i < 2; i++) {
      await goToCapturePage(page);
      await goToVerifyPage(page);
      
      await page.locator('nav >> button:has-text("Settings")').click();
      await expect(page.locator('h1:has-text("Settings")')).toBeVisible({ timeout: 5000 });
      
      await goToApplyPage(page);
    }
  });

  test('empty state messages are user-friendly', async ({ page }) => {
    // App starts on Overview - navigate to Apply first
    await goToApplyPage(page);
    // Apply page - no profiles
    await expect(page.locator('text=No setups found')).toBeVisible();
    await expect(page.locator('text=capture or import a setup first')).toBeVisible();
    
    // Verify page shows check computer heading and subtitle
    await goToVerifyPage(page);
    await expect(page.locator('text=Verify this computer matches your setup profile')).toBeVisible();
  });
});
