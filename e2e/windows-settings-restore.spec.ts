import { test, expect } from '@playwright/test';
import { installTauriMock } from './helpers/tauri-mock';

/**
 * A Windows setting belongs to no app. Choosing one for restore must reach the
 * engine as its full module ID, and its results must list under their own
 * "Windows settings" heading with counts equal to the rows.
 *
 * Events follow the engine's registry-set shape: a `windows-settings.<name>`
 * module, no source file, and a target that names one registry value.
 */
test('a chosen Windows setting reaches the engine by full ID and its results list under Windows settings', async ({ page }) => {
  await installTauriMock(page, {
    initialProfileFiles: ['C:\\test\\profiles\\test-profile.jsonc'],
  });

  await page.addInitScript(() => {
    localStorage.setItem('test:endstate-gui-settings', JSON.stringify({
      dryRunEnabled: false,
      dryRunDefaultCorrected: true,
    }));

    const TS = '2025-01-01T00:00:00.000Z';
    const restoreModules = [
      { id: 'apps.notepad-plus-plus', displayName: 'Notepad++', entryCount: 1 },
      { id: 'windows-settings.keyboard', displayName: 'Windows keyboard: repeat delay and rate', entryCount: 2 },
      { id: 'windows-settings.personalization', displayName: 'Windows theme: light or dark mode', entryCount: 1 },
    ];
    const registryItems = [
      { module: 'windows-settings.keyboard', target: 'HKCU\\Control Panel\\Keyboard\\KeyboardDelay', status: 'restored', reason: null, message: 'settings restored' },
      { module: 'windows-settings.keyboard', target: 'HKCU\\Control Panel\\Keyboard\\KeyboardSpeed', status: 'skipped_up_to_date', reason: 'already_up_to_date', message: 'target settings are already current' },
      { module: 'windows-settings.personalization', target: 'HKCU\\Software\\Example\\Personalize\\AppsUseLightTheme', status: 'failed', reason: 'restore_failed', message: 'Access is denied: HKCU\\Software\\Example\\Personalize' },
    ];
    (window as any).__restoreFilters = [];

    (window as any).__ENDSTATE_MOCK_ENGINE__ = {
      runEndstateStreaming: async (
        _settings: any,
        command: string,
        args: string[],
        onEvent: Function,
        options?: any,
      ) => {
        if (command === 'capabilities') {
          return { exitCode: 0, envelope: { success: true, data: { commands: ['capture', 'apply', 'verify', 'report'] } }, ndjsonEvents: [] };
        }
        if (command === 'report') {
          return { exitCode: 0, envelope: { success: true, data: { hasState: false } }, ndjsonEvents: [] };
        }
        const emit = async (evt: any) => {
          options?.onNdjsonEvent?.(evt);
          onEvent?.({ type: 'stdout', data: JSON.stringify(evt) + '\n' });
          await new Promise((r) => setTimeout(r, 10));
        };
        const filterIndex = args.indexOf('--restore-filter');
        const filter = filterIndex >= 0 ? args[filterIndex + 1].split(',') : [];
        if (filterIndex >= 0) (window as any).__restoreFilters.push(args[filterIndex + 1]);
        const isDryRun = args.includes('--dry-run');

        if (isDryRun) {
          await emit({ version: 1, runId: 'preview', timestamp: TS, event: 'item', id: 'WinDirStat.WinDirStat', driver: 'winget', status: 'to_install', reason: 'would_install', name: 'WinDirStat' });
        } else {
          await emit({ version: 1, runId: 'apply', timestamp: TS, event: 'phase', phase: 'apply' });
          await emit({ version: 1, runId: 'apply', timestamp: TS, event: 'item', id: 'WinDirStat.WinDirStat', driver: 'winget', status: 'installed', reason: '', name: 'WinDirStat' });
          // The engine restores only the modules the filter names.
          for (const item of registryItems.filter((entry) => filter.includes(entry.module))) {
            const restoreItem = {
              version: 1, runId: 'apply', timestamp: TS, event: 'restore-item',
              id: `registry-set:${item.target}`, module: item.module, restorer: 'registry-set',
              source: '', target: item.target, backupPath: null, targetExisted: true,
            };
            await emit({ ...restoreItem, status: 'restoring', reason: null, message: 'restoring settings' });
            await emit({ ...restoreItem, status: item.status, reason: item.reason, message: item.message });
          }
        }

        return {
          exitCode: 0,
          envelope: {
            success: true,
            data: {
              dryRun: isDryRun,
              summary: { total: 1, success: isDryRun ? 0 : 1, skipped: 0, failed: 0 },
              actions: [
                { id: 'windirstat', ref: 'WinDirStat.WinDirStat', driver: 'winget', name: 'WinDirStat', status: isDryRun ? 'to_install' : 'installed', reason: isDryRun ? 'would_install' : '', message: '', version: '', manual: null },
              ],
              restoreModulesAvailable: restoreModules,
              configModuleMap: {},
            },
          },
          ndjsonEvents: [],
        };
      },
    };
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.locator('[data-testid="intent-setup"]').click();
  await page.locator('[data-testid="profile-card-test-profile"]').click();
  await expect(page.locator('text=Preview complete')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('This profile includes settings for 1 app and 2 Windows settings')).toBeVisible();

  await page.getByRole('radio', { name: 'Install apps and restore settings' }).click();
  const windowsChoices = page.locator('[data-testid="config-module-selector-windows"]');
  await windowsChoices.getByRole('button', { name: 'Select all' }).click();
  await page.locator('[data-testid="setup-flow-apply"]').click();

  await expect(page.getByText('Setup completed with errors')).toBeVisible({ timeout: 15000 });
  expect(await page.evaluate(() => (window as any).__restoreFilters)).toEqual([
    'windows-settings.keyboard,windows-settings.personalization',
  ]);
  await expect(page.getByText('3 settings: 1 restored, 1 already up to date, 1 failed')).toBeVisible();

  const windowsResults = page.getByRole('group', { name: 'Windows settings' });
  await expect(windowsResults.getByText('RESTORED', { exact: true })).toHaveCount(1);
  await expect(windowsResults.getByText('UP TO DATE', { exact: true })).toHaveCount(1);
  await expect(windowsResults.getByText('FAILED', { exact: true })).toHaveCount(1);
  await expect(windowsResults.getByText("Couldn't restore this setting")).toBeVisible();
  // The registry path is detail for the hover title only.
  await expect(page.locator('text=/HKCU/')).toHaveCount(0);
});
