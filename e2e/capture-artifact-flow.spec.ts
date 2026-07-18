import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { installTauriMock } from './helpers/tauri-mock';

const bundleFixture = JSON.parse(readFileSync(
  fileURLToPath(new URL('./fixtures/capture_v2_bundle.fixture.json', import.meta.url)),
  'utf8',
)) as {
  fileName: string;
  extractedDirectory: string;
  manifestPath: string;
  manifest: {
    version: number;
    name: string;
    apps: Array<{ id: string; source: string }>;
    restore: unknown[];
  };
};

const capturedEvents = readFileSync(
  fileURLToPath(new URL('./fixtures/capture_captured.events.jsonl', import.meta.url)),
  'utf8',
)
  .trim()
  .split(/\r?\n/)
  .map((line) => JSON.parse(line));

test.describe('capture artifact flow regression', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await installTauriMock(page, {
      allowUnknownInvokes: true,
      zipImport: {
        extractedDirectory: bundleFixture.extractedDirectory,
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
      (window as any).__ENDSTATE_MOCK_ENGINE__ = {
        runEndstateStreaming: async (
          _settings: unknown,
          command: string,
          _args: string[],
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

    await page.goto(baseURL || '/');
    await page.waitForLoadState('networkidle');
  });

  test('shows captured apps and settings, then a clear save completion', async ({ page }) => {
    await page.getByTestId('intent-save').click();
    await page.getByTestId('save-flow-start-scan').click();

    await expect(page.getByText('DETECTED')).toBeVisible();
    await expect(page.getByText('EXCLUDED')).toHaveCount(0);
    await expect(page.getByText('1 setting captured')).toBeVisible();
    await expect(page.getByRole('button', { name: '1 settings' })).toBeVisible();

    await page.getByTestId('save-flow-save-file').click();
    await expect(page.getByText('Backup saved')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back to home' })).toBeVisible();
  });

  test('imports a v2 capture bundle and opens setup review', async ({ page }) => {
    await page.getByTestId('intent-setup').click();
    await page.locator('[data-testid="drop-zone"] input[type="file"]').setInputFiles({
      name: bundleFixture.fileName,
      mimeType: 'application/zip',
      buffer: Buffer.from('mocked capture bundle; extraction is supplied by the semantic bridge fixture'),
    });

    await expect(page.getByText(`Imported ${bundleFixture.fileName} — opening setup`)).toBeVisible();
    await expect(page.getByText('Preview complete')).toBeVisible();
    await expect(page.getByText(/Setting up from capture-v2/)).toBeVisible();
  });
});
