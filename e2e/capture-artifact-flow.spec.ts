import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { installTauriMock } from './helpers/tauri-mock';

const bundleFixture = JSON.parse(readFileSync(
  fileURLToPath(new URL('./fixtures/capture_v2_bundle.fixture.json', import.meta.url)),
  'utf8',
)) as {
  fileName: string;
  manifestPath: string;
  manifest: {
    version: number;
    name: string;
    apps: unknown[];
    configCaptures: Array<{
      captureId: string;
      moduleId: string;
      configSetId: string;
      sourceInstance: { evidence: { ref: string } };
      payloadRoot: string;
      payloadManifest: Array<{ relativePath: string; size: number; sha256: string }>;
      captureModule: { contentHash: string; snapshotPath: string };
    }>;
  };
  bundleFiles: Record<string, string>;
};

const capturedEvents = readFileSync(
  fileURLToPath(new URL('./fixtures/capture_captured.events.jsonl', import.meta.url)),
  'utf8',
)
  .trim()
  .split(/\r?\n/)
  .map((line) => JSON.parse(line));

const connectedJourneyBundle = Buffer.from(JSON.stringify({
  manifest: bundleFixture.manifest,
  bundleFiles: bundleFixture.bundleFiles,
}));
const connectedCapture = bundleFixture.manifest.configCaptures[0];
const connectedAppRef = connectedCapture.sourceInstance.evidence.ref;
const connectedAppName = connectedAppRef.replace('.', ' ');
const connectedModuleId = connectedCapture.moduleId;
const connectedSettingsDisplayName = `${connectedAppName} preferences`;
const connectedSettingsFileName = connectedCapture.payloadManifest[0].relativePath;
const connectedJourneyTestName = 'keeps the captured bundle connected through settings restore and undo';

async function seedConnectedJourneySettings(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('test:endstate-gui-settings', JSON.stringify({
      dryRunEnabled: false,
      showDetails: true,
    }));
  });
}

async function installConnectedJourneyFixture(page: Page) {
  await page.evaluate(({
    bundleBase64,
    manifestPath,
    appRef,
    appName,
    moduleId,
    configSetId,
    settingsDisplayName,
    settingsFileName,
  }) => {
    const state = {
      captureBase64: bundleBase64,
      importedBase64: null as string | null,
      previewArgs: null as string[] | null,
      applyArgs: null as string[] | null,
      revertArgs: [] as string[][],
      restoreJournal: null as string | null,
    };
    (window as any).__test_connectedJourney = state;

    const tauri = (window as any).__TAURI__;
    const originalInvoke = tauri.core.invoke;
    const connectedInvoke = async (command: string, args?: Record<string, unknown>) => {
      if (command === 'read_file_base64') {
        if (args?.path !== 'C:\\test\\cache\\capture-v2.zip') {
          throw new Error(`Connected journey read an unexpected capture path: ${String(args?.path)}`);
        }
        return state.captureBase64;
      }
      if (command === 'import_zip_from_base64') {
        if (args?.data !== state.captureBase64) {
          throw new Error('Connected journey import did not receive the captured bundle bytes');
        }
        state.importedBase64 = String(args.data);
        const importedPath = await originalInvoke(command, args);
        if (importedPath !== manifestPath) {
          throw new Error(`Connected journey imported an unexpected manifest: ${String(importedPath)}`);
        }
        return importedPath;
      }
      return originalInvoke(command, args);
    };
    tauri.core.invoke = connectedInvoke;
    tauri.invoke = connectedInvoke;

    const originalEngine = (window as any).__ENDSTATE_MOCK_ENGINE__;
    const result = (envelope: unknown) => ({
      exitCode: 0,
      envelope,
      stdout: JSON.stringify(envelope),
      stderr: '',
      ndjsonEvents: [],
    });
    const appItem = (status: 'to_install' | 'installed') => ({
      version: 1,
      runId: `connected-${status}`,
      timestamp: '2026-07-19T12:00:00Z',
      event: 'item',
      id: appRef,
      driver: 'winget',
      status,
      reason: null,
      name: appName,
    });

    (window as any).__ENDSTATE_MOCK_ENGINE__ = {
      runEndstateStreaming: async (
        settings: unknown,
        command: string,
        args: string[],
        onEvent: unknown,
        options?: { onNdjsonEvent?: (event: unknown) => void },
      ) => {
        if (command === 'capture') {
          const item = {
            version: 1,
            runId: 'capture-connected',
            timestamp: '2026-07-19T12:00:00Z',
            event: 'item',
            id: appRef,
            driver: 'winget',
            status: 'captured',
            reason: null,
            name: appName,
            message: `Captured ${appName}`,
          };
          options?.onNdjsonEvent?.(item);
          return result({
            success: true,
            data: {
              outputPath: 'C:\\test\\cache\\capture-v2.zip',
              outputFormat: 'zip',
              counts: { totalFound: 1, included: 1, skipped: 0 },
              appsIncluded: [{ id: appRef, name: appName, source: 'winget' }],
              configsIncluded: [moduleId],
              configModules: [{
                id: moduleId,
                displayName: settingsDisplayName,
                status: 'captured',
                filesCaptured: 1,
                wingetRefs: [appRef],
              }],
            },
          });
        }
        if (command !== 'apply') {
          return originalEngine.runEndstateStreaming(settings, command, args, onEvent, options);
        }
        if (state.importedBase64 !== state.captureBase64) {
          throw new Error('Connected journey cannot apply before importing the captured bytes');
        }
        if (args[0] !== '--profile' || args[1] !== manifestPath) {
          throw new Error(`Connected journey apply used the wrong manifest: ${args.join(' ')}`);
        }

        const isPreview = args.includes('--dry-run');
        const item = appItem(isPreview ? 'to_install' : 'installed');
        options?.onNdjsonEvent?.(item);
        if (isPreview) {
          state.previewArgs = [...args];
        } else {
          if (!state.previewArgs) {
            throw new Error('Connected journey cannot apply before preview');
          }
          if (!args.includes('--enable-restore') || !args.includes('--restore-filter') || !args.includes(moduleId)) {
            throw new Error(`Connected journey live apply omitted settings restore: ${args.join(' ')}`);
          }
          state.applyArgs = [...args];
          state.restoreJournal = 'restore-run-connected';
          options?.onNdjsonEvent?.({
            version: 1,
            runId: state.restoreJournal,
            timestamp: '2026-07-19T12:00:01Z',
            event: 'restore-item',
            module: moduleId,
            id: configSetId,
            status: 'restored',
            reason: null,
          });
        }

        return result({
          success: true,
          error: null,
          data: {
            counts: {
              installed: 1,
              alreadyInstalled: 0,
              failed: 0,
              skippedFiltered: 0,
            },
            items: [item],
            actions: [{ id: appRef, ref: appRef, status: isPreview ? 'to_install' : 'installed' }],
            restoreModulesAvailable: [{ id: moduleId, displayName: settingsDisplayName }],
            configModuleMap: { [appRef]: moduleId },
            restoreSummary: isPreview
              ? undefined
              : { total: 1, restored: 1, skipped: 0, failed: 0, backupLocation: 'C:\\test\\backups\\restore-run-connected' },
          },
        });
      },
      runEndstateOnce: async (
        settings: unknown,
        command: string,
        args: string[],
      ) => {
        if (command !== 'revert') {
          if (originalEngine.runEndstateOnce) {
            return originalEngine.runEndstateOnce(settings, command, args);
          }
          const streamed = await originalEngine.runEndstateStreaming(settings, command, args);
          return {
            ...streamed,
            success: streamed.exitCode === 0 && streamed.envelope?.success !== false,
            stdout: streamed.stdout ?? JSON.stringify(streamed.envelope),
            stderr: streamed.stderr ?? '',
          };
        }
        if (!state.restoreJournal) {
          throw new Error('Connected journey cannot undo without a live-apply restore journal');
        }
        const dryRun = args.includes('--dry-run');
        if (!dryRun && !state.revertArgs.some((call) => call.includes('--dry-run'))) {
          throw new Error('Connected journey cannot execute undo before its dry-run');
        }
        state.revertArgs.push([...args]);
        const envelope = {
          schemaVersion: '1.0',
          cliVersion: 'test-1.0',
          command: 'revert',
          runId: dryRun ? 'undo-preview-connected' : 'undo-connected',
          timestampUtc: '2026-07-19T12:00:02Z',
          success: true,
          error: null,
          data: {
            dryRun,
            revertedRestoreRunId: state.restoreJournal,
            revertCount: 1,
            skipCount: 0,
            failCount: 0,
            backupLocation: 'C:\\test\\backups\\undo-connected',
            results: [{
              id: `${moduleId}/${configSetId}`,
              targetPath: `C:\\Users\\test\\AppData\\Roaming\\${appName}\\${settingsFileName}`,
              type: 'revert',
              status: dryRun ? 'would_revert' : 'reverted',
              reason: null,
            }],
          },
        };
        return {
          success: true,
          envelope,
          exitCode: 0,
          stdout: JSON.stringify(envelope),
          stderr: '',
        };
      },
    };
  }, {
    bundleBase64: connectedJourneyBundle.toString('base64'),
    manifestPath: bundleFixture.manifestPath,
    appRef: connectedAppRef,
    appName: connectedAppName,
    moduleId: connectedModuleId,
    configSetId: connectedCapture.configSetId,
    settingsDisplayName: connectedSettingsDisplayName,
    settingsFileName: connectedSettingsFileName,
  });
}

test.describe('capture artifact flow regression', () => {
  test.beforeEach(async ({ page, baseURL }, testInfo) => {
    await installTauriMock(page, {
      allowUnknownInvokes: true,
      zipImport: {
        manifestPath: bundleFixture.manifestPath,
        manifestContent: JSON.stringify(bundleFixture.manifest),
        summary: {
          name: bundleFixture.manifest.name,
          version: bundleFixture.manifest.version,
          appCount: bundleFixture.manifest.apps.length,
        },
      },
    });

    await page.addInitScript((events) => {
      (window as any).__test_applyCalls = [];
      (window as any).__ENDSTATE_MOCK_ENGINE__ = {
        runEndstateStreaming: async (
          _settings: unknown,
          command: string,
          args: string[],
          _onEvent: unknown,
          options?: { onNdjsonEvent?: (event: unknown) => void },
        ) => {
          if (command === 'capabilities') {
            return {
              exitCode: 0,
              envelope: { success: true, data: { commands: ['capture', 'apply', 'verify', 'report'] } },
              ndjsonEvents: [],
            };
          }
          if (command === 'report') {
            return { exitCode: 0, envelope: { success: true, data: { hasState: false } }, ndjsonEvents: [] };
          }
          if (command === 'capture') {
            for (const event of events) options?.onNdjsonEvent?.(event);
            await new Promise((resolve) => setTimeout(resolve, 400));
            return {
              exitCode: 0,
              envelope: {
                success: true,
                data: {
                  outputPath: 'C:\\test\\cache\\capture-v2.zip',
                  outputFormat: 'zip',
                  counts: { totalFound: 1, included: 1, skipped: 0 },
                  appsIncluded: [{ id: 'VideoLAN.VLC', name: 'VLC media player', source: 'winget' }],
                  configsIncluded: ['apps.vlc'],
                  configModules: [{
                    id: 'apps.vlc',
                    displayName: 'VLC preferences',
                    status: 'captured',
                    filesCaptured: 1,
                    wingetRefs: ['VideoLAN.VLC'],
                  }],
                },
              },
              ndjsonEvents: events,
            };
          }
          if (command === 'apply') {
            if (!args.includes('--dry-run')) {
              throw new Error('Capture import regression test forbids non-dry-run apply');
            }
            (window as any).__test_applyCalls.push([...args]);
            await new Promise((resolve) => setTimeout(resolve, 250));
            if ((window as any).__test_failPreview) {
              throw new Error('Engine rejected capture provenance');
            }
            const item = {
              version: 1,
              runId: 'preview-fixture',
              timestamp: '2026-07-18T12:01:00Z',
              event: 'item',
              id: 'VideoLAN.VLC',
              driver: 'winget',
              status: 'present',
              reason: 'already_installed',
              name: 'VLC media player',
            };
            options?.onNdjsonEvent?.(item);
            return {
              exitCode: 0,
              envelope: {
                success: true,
                data: {
                  counts: { installed: 0, alreadyInstalled: 1, failed: 0 },
                  items: [item],
                },
              },
              ndjsonEvents: [item],
            };
          }
          return { exitCode: 0, envelope: { success: true, data: {} }, ndjsonEvents: [] };
        },
      };
    }, capturedEvents);

    if (testInfo.title === connectedJourneyTestName) {
      await seedConnectedJourneySettings(page);
    }

    await page.goto(baseURL || '/');
    await page.waitForLoadState('networkidle');

    if (testInfo.title === connectedJourneyTestName) {
      await installConnectedJourneyFixture(page);
    }
  });

  test('shows captured apps and settings, then a clear save completion', async ({ page }) => {
    await page.getByTestId('intent-save').click();
    await page.getByTestId('save-flow-start-scan').click();

    await expect(page.getByText('DETECTED', { exact: true })).toBeVisible();
    await expect(page.getByText('EXCLUDED')).toHaveCount(0);
    await expect(page.getByText('1 setting captured')).toBeVisible();
    await expect(page.getByRole('button', { name: '1 settings' })).toBeVisible();

    await page.getByTestId('save-flow-save-file').click();
    await expect(page.getByText('Backup saved')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back to home' })).toBeVisible();
  });

  test(connectedJourneyTestName, async ({ page }) => {
    await page.getByTestId('intent-save').click();
    await page.getByTestId('save-flow-start-scan').click();
    await expect(page.getByText('1 setting captured')).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('save-flow-save-file').click();
    const download = await downloadPromise;
    const downloadedPath = await download.path();
    expect(download.suggestedFilename()).toMatch(/\.zip$/);
    expect(downloadedPath).not.toBeNull();
    const downloadedBytes = readFileSync(downloadedPath!);
    expect(downloadedBytes).toEqual(connectedJourneyBundle);

    await expect(page.getByText('Backup saved')).toBeVisible();
    await page.getByRole('button', { name: 'Back to home' }).click();
    await page.getByTestId('intent-setup').click();
    await page.locator('[data-testid="drop-zone"] input[type="file"]').setInputFiles({
      name: download.suggestedFilename(),
      mimeType: 'application/zip',
      buffer: downloadedBytes,
    });

    await expect(page.getByText('Preview complete')).toBeVisible();
    await expect(page.getByText(`Imported ${download.suggestedFilename()} — setup review ready`)).toBeVisible();
    await page.getByRole('radio', { name: 'Install apps and restore settings' }).click();
    await page.getByRole('checkbox', { name: connectedSettingsDisplayName }).click();
    await page.getByTestId('setup-flow-apply').click();

    await expect(page.getByText('Setup complete')).toBeVisible();
    await expect(page.getByRole('button', { name: '1 setting restored', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Undo settings' }).click();
    await expect(page.getByText('Undo settings changes')).toBeVisible();
    await expect(page.getByText(connectedSettingsFileName)).toBeVisible();
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(page.getByText('Changes undone')).toBeVisible();
    await expect(page.getByText('1 setting restored successfully')).toBeVisible();

    const journey = await page.evaluate(() => (window as any).__test_connectedJourney);
    expect(journey.importedBase64).toBe(connectedJourneyBundle.toString('base64'));
    expect(journey.previewArgs).toEqual([
      '--profile', bundleFixture.manifestPath, '--dry-run',
    ]);
    expect(journey.applyArgs).toEqual([
      '--profile', bundleFixture.manifestPath,
      '--enable-restore', '--restore-filter', connectedModuleId,
    ]);
    expect(journey.revertArgs).toEqual([['--dry-run'], []]);
  });

  test('imports a v2 capture bundle and opens setup review', async ({ page }) => {
    const capture = bundleFixture.manifest.configCaptures[0];
    const payloadEntry = capture.payloadManifest[0];
    const payload = bundleFixture.bundleFiles[`${capture.payloadRoot}/${payloadEntry.relativePath}`];
    const moduleSnapshot = bundleFixture.bundleFiles[capture.captureModule.snapshotPath];
    expect(Buffer.byteLength(payload)).toBe(payloadEntry.size);
    expect(createHash('sha256').update(payload).digest('hex')).toBe(payloadEntry.sha256);
    expect(createHash('sha256').update(moduleSnapshot).digest('hex')).toBe(capture.captureModule.contentHash);

    await page.getByTestId('intent-setup').click();
    await page.locator('[data-testid="drop-zone"] input[type="file"]').setInputFiles({
      name: bundleFixture.fileName,
      mimeType: 'application/zip',
      buffer: Buffer.from('mocked capture bundle; extraction is supplied by the semantic bridge fixture'),
    });

    await expect(page.getByText(`Imported ${bundleFixture.fileName} — setup review ready`)).toHaveCount(0);
    await expect(page.getByText('Preview complete')).toBeVisible();
    await expect(page.getByText(`Imported ${bundleFixture.fileName} — setup review ready`)).toBeVisible();
    await expect(page.getByText(/Setting up from capture-v2/)).toBeVisible();

    const applyCalls = await page.evaluate(() => (window as any).__test_applyCalls as string[][]);
    expect(applyCalls).toHaveLength(1);
    expect(applyCalls[0]).toContain(bundleFixture.manifestPath);
    expect(applyCalls[0]).toContain('--dry-run');
  });

  test('does not report import success when setup preview rejects the bundle', async ({ page }) => {
    await page.evaluate(() => { (window as any).__test_failPreview = true; });
    await page.getByTestId('intent-setup').click();
    await page.locator('[data-testid="drop-zone"] input[type="file"]').setInputFiles({
      name: bundleFixture.fileName,
      mimeType: 'application/zip',
      buffer: Buffer.from('mocked rejected capture bundle'),
    });

    await expect(page.getByText('Engine rejected capture provenance', { exact: true })).toBeVisible();
    await expect(page.getByText(`Imported ${bundleFixture.fileName} — setup review ready`)).toHaveCount(0);
    await expect(page.getByText(/Failed to import capture-v2\.zip/)).toBeVisible();
  });

  test('stages browser manifest imports through the transactional command', async ({ page }) => {
    await page.getByTestId('intent-setup').click();
    await page.locator('[data-testid="drop-zone"] input[type="file"]').setInputFiles({
      name: 'portable-profile.jsonc',
      mimeType: 'application/json',
      buffer: Buffer.from('{"version":1,"name":"portable-profile","apps":[]}'),
    });

    await expect(page.getByText('Imported portable-profile.jsonc — setup review ready')).toBeVisible();
    const operations = await page.evaluate(() => (window as any).__test_operations as Array<{ type: string }>);
    expect(operations.filter((operation) => operation.type === 'import_profile_text')).toHaveLength(1);
    expect(operations.filter((operation) => operation.type === 'write_text_file')).toHaveLength(0);
  });
});
