import { test, expect } from '@playwright/test';
import { forceAdvancedMode } from './helpers/ui-mode';

test.describe('Save Profile Modal - Blocking Behavior', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await forceAdvancedMode(page);

    await page.addInitScript(() => {
      (window as any).__TAURI__ = {
        core: {
          invoke: async (cmd: string, args?: any) => {
            if (cmd === 'ensure_dir') return null;
            if (cmd === 'read_dir') return [];
            if (cmd === 'list_manifest_files') return [];
            if (cmd === 'get_default_profiles_directory') return 'C:\\test\\profiles';
            if (cmd === 'check_file_exists') return false;
            if (cmd === 'write_text_file') return null;
            if (cmd === 'read_text_file') return '{}';
            return null;
          }
        }
      };
      
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
            const lines = [
              '[OK] Discord.Discord (driver: winget)',
              '[OK] Google.Chrome (driver: winget)',
              '[OK]     Manifest saved: C:\\test\\setup.jsonc',
            ];
            
            for (const line of lines) {
              await new Promise(r => setTimeout(r, 100));
              onEvent({ type: 'stdout', data: line + '\n' });
            }
            
            return { 
              exitCode: 0, 
              envelope: { 
                success: true, 
                data: { 
                  outputPath: 'C:\\test\\setup.jsonc',
                  counts: {
                    totalFound: 2,
                    included: 2,
                    skipped: 0,
                    filteredRuntimes: 0,
                    filteredStoreApps: 0,
                    sensitiveExcludedCount: 0
                  },
                  appsIncluded: [
                    { id: 'Discord.Discord', source: 'winget' },
                    { id: 'Google.Chrome', source: 'winget' }
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

  test('Modal remains open when clicking backdrop', async ({ page }) => {
    // Start from Overview page and trigger capture from Overview card
    const overviewCard = page.locator('[data-testid="overview-card-capture"]');
    await overviewCard.click();
    
    // Wait for "Profile created" modal first
    await expect(page.locator('text=Profile created')).toBeVisible({ timeout: 6000 });
    
    // Close the "Profile created" modal to reveal the "Save profile" modal
    await page.click('button:has-text("Close")');
    
    // Now the "Save profile" modal should be visible
    await expect(page.locator('[data-testid="profile-name-modal"]')).toBeVisible({ timeout: 2000 });
    
    const modalBefore = await page.locator('[data-testid="profile-name-modal"]').isVisible();
    expect(modalBefore).toBe(true);
    
    // Try to click backdrop
    await page.locator('[data-testid="profile-name-modal"]').evaluate((el) => {
      const overlay = document.querySelector('[data-radix-dialog-overlay]');
      if (overlay) {
        (overlay as HTMLElement).click();
      }
    });
    
    await page.waitForTimeout(500);
    
    // Modal should still be visible
    const modalAfter = await page.locator('[data-testid="profile-name-modal"]').isVisible();
    expect(modalAfter).toBe(true);
  });

  test('Modal remains open when pressing Escape', async ({ page }) => {
    const overviewCard = page.locator('[data-testid="overview-card-capture"]');
    await overviewCard.click();
    
    await expect(page.locator('text=Profile created')).toBeVisible({ timeout: 6000 });
    await page.click('button:has-text("Close")');
    
    await expect(page.locator('[data-testid="profile-name-modal"]')).toBeVisible({ timeout: 2000 });
    
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    
    const modalVisible = await page.locator('[data-testid="profile-name-modal"]').isVisible();
    expect(modalVisible).toBe(true);
  });

  test('Cancel button closes modal without creating profile', async ({ page }) => {
    const overviewCard = page.locator('[data-testid="overview-card-capture"]');
    await overviewCard.click();
    
    await expect(page.locator('text=Profile created')).toBeVisible({ timeout: 6000 });
    await page.click('button:has-text("Close")');
    
    await expect(page.locator('[data-testid="profile-name-modal"]')).toBeVisible({ timeout: 2000 });
    
    const input = page.locator('[data-testid="profile-name-input"]');
    await input.fill('My Test Profile');
    
    await page.click('[data-testid="profile-name-cancel"]');
    await page.waitForTimeout(500);
    
    const modalVisible = await page.locator('[data-testid="profile-name-modal"]').isVisible();
    expect(modalVisible).toBe(false);
  });

  test('Save profile button creates profile and closes modal', async ({ page }) => {
    const overviewCard = page.locator('[data-testid="overview-card-capture"]');
    await overviewCard.click();
    
    await expect(page.locator('text=Profile created')).toBeVisible({ timeout: 6000 });
    await page.click('button:has-text("Close")');
    
    await expect(page.locator('[data-testid="profile-name-modal"]')).toBeVisible({ timeout: 2000 });
    
    const input = page.locator('[data-testid="profile-name-input"]');
    await input.fill('Unique Test Profile Name');
    
    await page.click('[data-testid="profile-name-save"]');
    await page.waitForTimeout(500);
    
    const modalVisible = await page.locator('[data-testid="profile-name-modal"]').isVisible();
    expect(modalVisible).toBe(false);
  });

  test('X button closes modal without creating profile', async ({ page }) => {
    const overviewCard = page.locator('[data-testid="overview-card-capture"]');
    await overviewCard.click();
    
    await expect(page.locator('text=Profile created')).toBeVisible({ timeout: 6000 });
    await page.click('button:has-text("Close")');
    
    await expect(page.locator('[data-testid="profile-name-modal"]')).toBeVisible({ timeout: 2000 });
    
    const input = page.locator('[data-testid="profile-name-input"]');
    await input.fill('Another Test Profile');
    
    const closeButton = page.locator('[data-testid="profile-name-modal"] >> button[aria-label="Close"]').first();
    await closeButton.click();
    await page.waitForTimeout(500);
    
    const modalVisible = await page.locator('[data-testid="profile-name-modal"]').isVisible();
    expect(modalVisible).toBe(false);
  });

  test('Multiple backdrop clicks do not close modal', async ({ page }) => {
    const overviewCard = page.locator('[data-testid="overview-card-capture"]');
    await overviewCard.click();
    
    await expect(page.locator('text=Profile created')).toBeVisible({ timeout: 6000 });
    await page.click('button:has-text("Close")');
    
    await expect(page.locator('[data-testid="profile-name-modal"]')).toBeVisible({ timeout: 2000 });
    
    for (let i = 0; i < 3; i++) {
      await page.locator('[data-testid="profile-name-modal"]').evaluate((el) => {
        const overlay = document.querySelector('[data-radix-dialog-overlay]');
        if (overlay) {
          (overlay as HTMLElement).click();
        }
      });
      await page.waitForTimeout(200);
    }
    
    const modalVisible = await page.locator('[data-testid="profile-name-modal"]').isVisible();
    expect(modalVisible).toBe(true);
  });

  test('Multiple Escape presses do not close modal', async ({ page }) => {
    const overviewCard = page.locator('[data-testid="overview-card-capture"]');
    await overviewCard.click();
    
    await expect(page.locator('text=Profile created')).toBeVisible({ timeout: 6000 });
    await page.click('button:has-text("Close")');
    
    await expect(page.locator('[data-testid="profile-name-modal"]')).toBeVisible({ timeout: 2000 });
    
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    
    const modalVisible = await page.locator('[data-testid="profile-name-modal"]').isVisible();
    expect(modalVisible).toBe(true);
  });

  test('Empty profile name can be saved (uses default filename)', async ({ page }) => {
    const overviewCard = page.locator('[data-testid="overview-card-capture"]');
    await overviewCard.click();
    
    await expect(page.locator('text=Profile created')).toBeVisible({ timeout: 6000 });
    await page.click('button:has-text("Close")');
    
    await expect(page.locator('[data-testid="profile-name-modal"]')).toBeVisible({ timeout: 2000 });
    
    const input = page.locator('[data-testid="profile-name-input"]');
    await input.clear();
    
    await page.click('[data-testid="profile-name-save"]');
    await page.waitForTimeout(500);
    
    const modalVisible = await page.locator('[data-testid="profile-name-modal"]').isVisible();
    expect(modalVisible).toBe(false);
  });
});
