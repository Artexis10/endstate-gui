import { test, expect } from '@playwright/test';
import { installEngineMocks } from './helpers/mock-engine';
import { openApp } from './helpers/ui-mode';

/**
 * A Windows setting belongs to no app. Choosing one for restore must reach the
 * engine as its full module ID, and its results must list under their own
 * "Windows settings" heading with counts equal to the rows.
 *
 * Events follow the engine's registry-set shape: a `windows-settings.<name>`
 * module, no source file, and a target that names one registry value. Engine
 * 2.32.0 adds a human `label`; the failed item has none, as from an older engine.
 */
test('a chosen Windows setting reaches the engine by full ID and its results list under Windows settings', async ({ page }) => {
  await installEngineMocks(page, {
    settings: { dryRunEnabled: false, dryRunDefaultCorrected: true },
  });

  await page.addInitScript(() => {
    const kit = (window as any).__E2E_MOCK_KIT__;
    const TS = '2025-01-01T00:00:00.000Z';
    const restoreModules = [
      { id: 'apps.notepad-plus-plus', displayName: 'Notepad++', entryCount: 1 },
      { id: 'windows-settings.keyboard', displayName: 'Windows keyboard: repeat delay and rate', entryCount: 2 },
      { id: 'windows-settings.personalization', displayName: 'Windows theme: light or dark mode', entryCount: 1 },
    ];
    const registryItems = [
      { module: 'windows-settings.keyboard', target: 'HKCU\\Control Panel\\Keyboard\\KeyboardDelay', label: 'Delay before a held key starts repeating', status: 'restored', reason: null, message: 'settings restored' },
      { module: 'windows-settings.keyboard', target: 'HKCU\\Control Panel\\Keyboard\\KeyboardSpeed', label: 'How fast a held key repeats', status: 'skipped_up_to_date', reason: 'already_up_to_date', message: 'target settings are already current' },
      { module: 'windows-settings.personalization', target: 'HKCU\\Software\\Example\\Personalize\\AppsUseLightTheme', status: 'failed', reason: 'restore_failed', message: 'cannot set DWORD value: Access is denied.' },
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
        const startup = kit.startup(command);
        if (startup) return startup;
        const emit = kit.emitter(onEvent, options, 10);
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
              ...(item.label ? { label: item.label } : {}),
            };
            await emit({ ...restoreItem, status: 'restoring', reason: null, message: 'restoring settings' });
            await emit({ ...restoreItem, status: item.status, reason: item.reason, message: item.message });
          }
        }

        return kit.result({
          dryRun: isDryRun,
          summary: { total: 1, success: isDryRun ? 0 : 1, skipped: 0, failed: 0 },
          actions: [
            { id: 'windirstat', ref: 'WinDirStat.WinDirStat', driver: 'winget', name: 'WinDirStat', status: isDryRun ? 'to_install' : 'installed', reason: isDryRun ? 'would_install' : '', message: '', version: '', manual: null },
          ],
          restoreModulesAvailable: restoreModules,
          configModuleMap: {},
        });
      },
    };
  });

  await openApp(page);
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
  await expect(page.getByRole('button', { name: '3 settings (1 failed)' })).toBeVisible();

  // The failure leads, with its reason, outside the list; the others stay
  // under their heading by label alone.
  const attention = page.getByRole('group', { name: 'Needs attention' });
  await expect(attention.getByText('FAILED', { exact: true })).toHaveCount(1);
  await expect(attention.getByText("Couldn't restore this setting")).toBeVisible();
  const windowsResults = page.getByRole('group', { name: 'Windows settings' });
  await expect(windowsResults.getByText('RESTORED', { exact: true })).toHaveCount(1);
  await expect(windowsResults.getByText('UP TO DATE', { exact: true })).toHaveCount(1);
  await expect(windowsResults.getByText('FAILED', { exact: true })).toHaveCount(0);
  await expect(windowsResults.getByText('Delay before a held key starts repeating', { exact: true })).toBeVisible();
  // Registry paths, value names and registry errors are hover-title detail only.
  await expect(page.getByText(/HKCU|KeyboardDelay|KeyboardSpeed|AppsUseLightTheme|DWORD/)).toHaveCount(0);
});
