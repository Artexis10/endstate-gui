import { test, expect } from '@playwright/test';
import { installTauriMock } from './helpers/tauri-mock';

/**
 * E2E for the Setup-flow activity feed restore/app row presentation fix.
 *
 * Streams a mocked apply+verify lifecycle that reproduces the user's screenshot:
 *  - a legacy config-restore item (raw `/copy:` spec, module empty) that
 *    transitions restoring -> restored, and
 *  - one app streamed under its winget `ref` across apply and verify while the
 *    envelope action is keyed by the manifest `id` (ref != id).
 *
 * Asserts the raw copy-spec never appears, restore rows read RESTORED (engine
 * display name), and each item renders exactly one row (no cross-phase / ref-vs-id
 * duplicates). Events are contract-shaped (version/runId/timestamp + full field
 * set) per streaming-events golden discipline.
 */

test.describe('Setup activity feed — restore & app row presentation', () => {
  test.beforeEach(async ({ page }) => {
    await installTauriMock(page, {
      initialProfileFiles: ['C:\\test\\profiles\\test-profile.jsonc'],
    });

    await page.addInitScript(() => {
      const TS = '2025-01-01T00:00:00.000Z';
      // Inlined here: addInitScript runs in the browser, so module-scope consts
      // from the test file are not in scope.
      const RESTORE_SPEC =
        'copy:./configs/notepad-plus-plus/contextMenu.xml->%APPDATA%/Notepad++/contextMenu.xml';
      const restoreModules = [{ id: 'notepad-plus-plus', displayName: 'Notepad++', entryCount: 1 }];

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

          const isDryRun = args.includes('--dry-run');
          const emit = async (evt: any) => {
            options?.onNdjsonEvent?.(evt);
            onEvent?.({ type: 'stdout', data: JSON.stringify(evt) + '\n' });
            await new Promise((r) => setTimeout(r, 10));
          };

          if (isDryRun) {
            // Preview: one installable app + a restorable settings module so the
            // "apps and settings" option and Notepad++ checkbox appear.
            await emit({ version: 1, runId: 'preview', timestamp: TS, event: 'item', id: 'WinDirStat.WinDirStat', driver: 'winget', status: 'to_install', reason: 'would_install', name: 'WinDirStat' });
            return {
              exitCode: 0,
              envelope: {
                success: true,
                data: {
                  dryRun: true,
                  summary: { total: 1, success: 0, skipped: 0, failed: 0 },
                  actions: [
                    { id: 'windirstat', ref: 'WinDirStat.WinDirStat', driver: 'winget', name: 'WinDirStat', status: 'to_install', reason: 'would_install', message: '', version: '', manual: null },
                  ],
                  restoreModulesAvailable: restoreModules,
                  configModuleMap: {},
                },
              },
              ndjsonEvents: [],
            };
          }

          // Real apply: app streams under its winget ref across apply+verify;
          // envelope action is keyed by the manifest id (ref != id). Restore item
          // transitions restoring -> restored.
          await emit({ version: 1, runId: 'apply', timestamp: TS, event: 'phase', phase: 'apply' });
          await emit({ version: 1, runId: 'apply', timestamp: TS, event: 'item', id: 'WinDirStat.WinDirStat', driver: 'winget', status: 'installing', reason: '', name: 'WinDirStat' });
          await emit({ version: 1, runId: 'apply', timestamp: TS, event: 'item', id: 'WinDirStat.WinDirStat', driver: 'winget', status: 'installed', reason: '', name: 'WinDirStat' });
          await emit({ version: 1, runId: 'apply', timestamp: TS, event: 'restore-item', id: RESTORE_SPEC, module: '', restorer: 'copy', source: './configs/notepad-plus-plus/contextMenu.xml', target: '%APPDATA%/Notepad++/contextMenu.xml', status: 'restoring', reason: null, backupPath: null, targetExisted: true, message: '' });
          await emit({ version: 1, runId: 'apply', timestamp: TS, event: 'restore-item', id: RESTORE_SPEC, module: '', restorer: 'copy', source: './configs/notepad-plus-plus/contextMenu.xml', target: '%APPDATA%/Notepad++/contextMenu.xml', status: 'restored', reason: null, backupPath: null, targetExisted: true, message: 'restored successfully' });
          await emit({ version: 1, runId: 'apply', timestamp: TS, event: 'phase', phase: 'verify' });
          await emit({ version: 1, runId: 'apply', timestamp: TS, event: 'item', id: 'WinDirStat.WinDirStat', driver: 'winget', status: 'present', reason: '', name: 'WinDirStat' });
          await emit({ version: 1, runId: 'apply', timestamp: TS, event: 'summary', phase: 'verify', total: 1, success: 1, skipped: 0, failed: 0 });

          return {
            exitCode: 0,
            envelope: {
              success: true,
              data: {
                dryRun: false,
                summary: { total: 1, success: 1, skipped: 0, failed: 0 },
                actions: [
                  { id: 'windirstat', ref: 'WinDirStat.WinDirStat', driver: 'winget', name: 'WinDirStat', status: 'installed', reason: '', message: 'Installed successfully', version: '2.7.0', manual: null },
                ],
                restoreSummary: { total: 1, restored: 1, skipped: 0, failed: 0, backupLocation: null },
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
  });

  test('restore rows are friendly and single, app rows do not duplicate across phases', async ({ page }) => {
    await page.locator('[data-testid="intent-setup"]').click();
    await expect(page.locator('[data-testid="setup-flow"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="profile-card-test-profile"]').click();
    await expect(page.locator('text=Preview complete')).toBeVisible({ timeout: 10000 });

    await page.locator('[data-testid="setup-flow-apply"]').click();
    await expect(page.locator('text=Setup complete')).toBeVisible({ timeout: 15000 });

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
});
