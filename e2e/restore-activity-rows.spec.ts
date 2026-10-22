import { test, expect, type Page } from '@playwright/test';
import { installEngineMocks } from './helpers/mock-engine';
import { openApp, previewTestProfile } from './helpers/ui-mode';

/**
 * E2E for the Setup-flow activity feed restore/app row presentation.
 *
 * Streams a mocked apply+verify lifecycle that reproduces the user's screenshot:
 *  - a legacy config-restore item (raw `/copy:` spec, module empty) that
 *    transitions restoring -> restored,
 *  - module-lane restore items that end skipped_up_to_date,
 *    skipped_missing_source and failed, and
 *  - one app streamed under its winget `ref` across apply and verify while the
 *    envelope action is keyed by the manifest `id` (ref != id).
 *
 * Events are contract-shaped (version/runId/timestamp + full field set) per
 * streaming-events golden discipline. The envelope carries no restore summary,
 * like the real engine's.
 */

async function installRestoreMock(page: Page, options: { dryRunSetting: boolean }) {
  await installEngineMocks(page, {
    settings: { dryRunEnabled: options.dryRunSetting, dryRunDefaultCorrected: true },
  });

  await page.addInitScript(() => {
    const kit = (window as any).__E2E_MOCK_KIT__;
    const TS = '2025-01-01T00:00:00.000Z';
    // Inlined here: addInitScript runs in the browser, so module-scope consts
    // from the test file are not in scope.
    const RESTORE_SPEC =
      'copy:./configs/notepad-plus-plus/contextMenu.xml->%APPDATA%/Notepad++/contextMenu.xml';
    const restoreModules = [
      { id: 'notepad-plus-plus', displayName: 'Notepad++', entryCount: 1 },
      { id: 'vscode', displayName: 'Visual Studio Code', entryCount: 2 },
      { id: 'windows-terminal', displayName: 'Windows Terminal', entryCount: 1 },
    ];
    const moduleItems = [
      { module: 'vscode', file: 'settings.json', status: 'skipped_up_to_date', reason: 'already_up_to_date', message: 'target settings are already current' },
      { module: 'vscode', file: 'keybindings.json', status: 'skipped_missing_source', reason: 'source_missing', message: 'optional settings source is missing' },
      { module: 'windows-terminal', file: 'settings.json', status: 'failed', reason: 'restore_failed', message: 'The file is in use by another program' },
    ];

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

        const isDryRun = args.includes('--dry-run');
        // The setup flow's own previews never pass a restore filter; an Apply
        // under the dry-run setting does.
        const isPreview = isDryRun && !args.includes('--restore-filter');
        const emit = kit.emitter(onEvent, options, 10);

        if (isPreview) {
          // Preview: one installable app + restorable settings modules so the
          // "apps and settings" option and module checkboxes appear.
          await emit({ version: 1, runId: 'preview', timestamp: TS, event: 'item', id: 'WinDirStat.WinDirStat', driver: 'winget', status: 'to_install', reason: 'would_install', name: 'WinDirStat' });
          return kit.result({
            dryRun: true,
            summary: { total: 1, success: 0, skipped: 0, failed: 0 },
            actions: [
              { id: 'windirstat', ref: 'WinDirStat.WinDirStat', driver: 'winget', name: 'WinDirStat', status: 'to_install', reason: 'would_install', message: '', version: '', manual: null },
            ],
            restoreModulesAvailable: restoreModules,
            configModuleMap: {},
          });
        }

        // Apply: app streams under its winget ref across apply+verify; envelope
        // action is keyed by the manifest id (ref != id). Each restore item
        // transitions restoring -> terminal. A dry run skips install and verify
        // and still reports `restored` for an item it would restore.
        if (!isDryRun) {
          await emit({ version: 1, runId: 'apply', timestamp: TS, event: 'phase', phase: 'apply' });
          await emit({ version: 1, runId: 'apply', timestamp: TS, event: 'item', id: 'WinDirStat.WinDirStat', driver: 'winget', status: 'installing', reason: '', name: 'WinDirStat' });
          await emit({ version: 1, runId: 'apply', timestamp: TS, event: 'item', id: 'WinDirStat.WinDirStat', driver: 'winget', status: 'installed', reason: '', name: 'WinDirStat' });
        }
        await emit({ version: 1, runId: 'apply', timestamp: TS, event: 'restore-item', id: RESTORE_SPEC, module: '', restorer: 'copy', source: './configs/notepad-plus-plus/contextMenu.xml', target: '%APPDATA%/Notepad++/contextMenu.xml', status: 'restoring', reason: null, backupPath: null, targetExisted: true, message: '' });
        await emit({ version: 1, runId: 'apply', timestamp: TS, event: 'restore-item', id: RESTORE_SPEC, module: '', restorer: 'copy', source: './configs/notepad-plus-plus/contextMenu.xml', target: '%APPDATA%/Notepad++/contextMenu.xml', status: 'restored', reason: null, backupPath: null, targetExisted: true, message: 'restored successfully' });
        for (const item of moduleItems) {
          const restoreItem = {
            version: 1, runId: 'apply', timestamp: TS, event: 'restore-item',
            id: `${item.module}/${item.file}`, module: item.module, restorer: 'copy',
            source: `./configs/${item.module}/${item.file}`, target: `%APPDATA%/${item.module}/${item.file}`,
            backupPath: null, targetExisted: true,
          };
          await emit({ ...restoreItem, status: 'restoring', reason: null, message: '' });
          await emit({ ...restoreItem, status: item.status, reason: item.reason, message: item.message });
        }
        if (!isDryRun) {
          await emit({ version: 1, runId: 'apply', timestamp: TS, event: 'phase', phase: 'verify' });
          await emit({ version: 1, runId: 'apply', timestamp: TS, event: 'item', id: 'WinDirStat.WinDirStat', driver: 'winget', status: 'present', reason: '', name: 'WinDirStat' });
          await emit({ version: 1, runId: 'apply', timestamp: TS, event: 'summary', phase: 'verify', total: 1, success: 1, skipped: 0, failed: 0 });
        }

        return kit.result({
          dryRun: isDryRun,
          summary: { total: 1, success: isDryRun ? 0 : 1, skipped: 0, failed: 0 },
          actions: [
            { id: 'windirstat', ref: 'WinDirStat.WinDirStat', driver: 'winget', name: 'WinDirStat', status: isDryRun ? 'to_install' : 'installed', reason: isDryRun ? 'would_install' : '', message: isDryRun ? '' : 'Installed successfully', version: '2.7.0', manual: null },
          ],
          restoreModulesAvailable: restoreModules,
          configModuleMap: {},
        });
      },
    };
  });

  await openApp(page);
}

async function applyWithSettings(page: Page) {
  await previewTestProfile(page);
  await page.getByRole('radio', { name: 'Install apps and restore settings' }).click();
  await page.getByRole('button', { name: 'Select all' }).click();
  await page.locator('[data-testid="setup-flow-apply"]').click();
}

test.describe('Setup activity feed — restore & app row presentation', () => {
  test('restore rows are friendly and single, app rows do not duplicate across phases', async ({ page }) => {
    await installRestoreMock(page, { dryRunSetting: false });
    await previewTestProfile(page);

    await page.locator('[data-testid="setup-flow-apply"]').click();
    await expect(page.getByText('Setup completed with errors')).toBeVisible({ timeout: 15000 });

    // Defect 1: the raw copy-spec must never be visible anywhere.
    await expect(page.locator('text=/\\/copy:/')).toHaveCount(0);
    await expect(page.locator('text=/->%APPDATA%/')).toHaveCount(0);

    // Defect 1 (friendly name) + defect 2 (single row): exactly one restore row,
    // engine display name + file basename, labelled RESTORED. (The preview
    // carries the restore module, so its display name threads into the apply.)
    await expect(page.getByText('Notepad++ · contextMenu.xml')).toHaveCount(1);
    await expect(page.getByText('RESTORED', { exact: true })).toHaveCount(1);

    // Defect 3: never the app INSTALLING verb on a restore row (the whole feed
    // has settled to terminal states here).
    await expect(page.getByText('RESTORING', { exact: true })).toHaveCount(0);

    // App-row cross-phase dedup: the app streamed under its ref across apply and
    // verify, envelope keyed by manifest id — it must render exactly one row.
    await expect(page.getByText('WinDirStat', { exact: true })).toHaveCount(1);
  });

  // The header used to fold "not in saved setup" into a skipped count it never
  // showed, while the row itself read a warning MISSING.
  test('a mixed restore run shows each outcome, and the settings chip counts equal the rows', async ({ page }) => {
    await installRestoreMock(page, { dryRunSetting: false });
    await applyWithSettings(page);

    await expect(page.getByText('Setup completed with errors')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: '4 settings (1 failed)' })).toBeVisible();

    await expect(page.getByText('RESTORED', { exact: true })).toHaveCount(1);
    await expect(page.getByText('UP TO DATE', { exact: true })).toHaveCount(1);
    await expect(page.getByText('NOT IN SETUP', { exact: true })).toHaveCount(1);
    await expect(page.getByText('MISSING', { exact: true })).toHaveCount(0);
    await expect(page.getByText('FAILED', { exact: true })).toHaveCount(1);

    // A missing optional file is neutral; a real failure stays an error.
    await expect(page.getByText('NOT IN SETUP', { exact: true })).toHaveClass(/text-muted-foreground/);
    await expect(page.getByText('FAILED', { exact: true })).toHaveClass(/text-status-danger/);

    // A run that restored a setting offers to undo it (the dry-run case below relies on this).
    await expect(page.getByRole('button', { name: 'Undo settings' })).toBeVisible();
  });

  // The engine reports `restored` per item in a dry run, so a row labelled from
  // the item alone told the user a preview had restored their settings.
  test('a dry run never shows a restore row as restored', async ({ page }) => {
    await installRestoreMock(page, { dryRunSetting: true });
    await applyWithSettings(page);

    // A preview with a failed row keeps preview wording; it never claims a setup.
    await expect(page.getByText('Preview completed with errors — nothing was installed')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Setup completed with errors')).toHaveCount(0);
    await expect(page.getByText('TO RESTORE', { exact: true })).toHaveCount(1);
    await expect(page.getByText('RESTORED', { exact: true })).toHaveCount(0);
    await expect(page.getByText(/\b\d+ restored\b/)).toHaveCount(0);

    // A preview changed nothing, so there is nothing to undo.
    await expect(page.getByRole('button', { name: 'Undo settings' })).toHaveCount(0);
  });
});
