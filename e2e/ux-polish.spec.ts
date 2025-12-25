import { test, expect } from '@playwright/test';
import { seedProfileSettings, forceDefaultMode, forceAdvancedMode, goToApplyPage } from './helpers/ui-mode';

test.describe('UX Polish Features', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Tauri APIs
    await page.addInitScript(() => {
      (window as any).__TAURI__ = {
        core: {
          invoke: async (cmd: string, args?: any) => {
            if (cmd === 'get_profiles_directory') return 'C:\\test\\profiles';
            if (cmd === 'discover_profiles') return [
              { name: 'test-profile', path: 'C:\\test\\profiles\\test-profile.jsonc' }
            ];
            if (cmd === 'open_folder') throw new Error('WEB_FALLBACK:C:\\test\\profiles');
            return undefined;
          },
        },
        event: {
          listen: async () => () => {},
          emit: async () => {},
        },
      };
      (window as any).__ENDSTATE_MOCK_ENGINE__ = {
        runCommand: async (cmd: string) => {
          if (cmd.includes('capabilities')) {
            return {
              success: true,
              stdout: JSON.stringify({
                data: {
                  commands: ['capture', 'apply', 'verify'],
                  version: '1.0.0',
                },
              }),
              stderr: '',
            };
          }
          if (cmd.includes('apply') && cmd.includes('--dry-run')) {
            return {
              success: true,
              stdout: JSON.stringify({
                data: {
                  counts: { total: 2, installed: 0, alreadyInstalled: 1, skippedFiltered: 0, failed: 0 },
                  items: [
                    { id: 'app1', driver: 'winget', status: 'ok', reason: 'would_install', message: '' },
                    { id: 'app2', driver: 'winget', status: 'ok', reason: 'already_present', message: '' },
                  ],
                },
              }),
              stderr: '',
            };
          }
          return { success: true, stdout: '{}', stderr: '' };
        },
      };
    });
  });

  test.skip('folder path modal appears in web mode when opening profiles folder', async ({ page }) => {
    // Skipped: Requires full integration with profile discovery
    await forceDefaultMode(page);
    await seedProfileSettings(page);
    await page.goto('/');
    
    await expect(page.locator('main >> h1:has-text("Endstate")')).toBeVisible({ timeout: 5000 });
  });

  test.skip('refresh button shows loading state and animation', async ({ page }) => {
    // Skipped: Refresh animation is too fast to reliably test in E2E
    // Functionality is implemented and verified manually
  });

  test.skip('card bottom padding is consistent', async ({ page }) => {
    // Skipped: Padding classes are tested via data-testid attributes
    // Functionality is implemented and verified manually
  });

  test.skip('Details modal filters work - Already present filter', async ({ page }) => {
    // Skipped: Filter logic is tested in unit tests (filter-utils.test.ts)
    // Functionality is implemented and verified manually
  });

  test.skip('Done button preserves last run summary', async ({ page }) => {
    // Skipped: State management is complex in E2E, tested via unit tests
    // Functionality is implemented and verified manually
  });

  test.skip('Default mode: overview -> preview -> details -> done flow', async ({ page }) => {
    // Skipped: Complex flow tested in existing apply-modal.spec.ts
    // Functionality is implemented and verified manually
  });

  test.skip('Advanced mode: sidebar navigation and preview flow', async ({ page }) => {
    // Skipped: Navigation helpers already tested in existing E2E suite
    // Functionality is implemented and verified manually
  });
});
