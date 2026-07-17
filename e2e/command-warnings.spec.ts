import { expect, test, type Page } from '@playwright/test';
import { installTauriMock } from './helpers/tauri-mock';

const previewMessage = 'Preview warning from the completed dry-run envelope.';
const liveMessage = 'Live warning from the completed apply envelope.';

async function seedDryRunOff(page: Page) {
  await page.addInitScript(() => {
    const key = 'test:endstate-gui-settings';
    const existing = localStorage.getItem(key);
    const settings = existing ? JSON.parse(existing) : {};
    settings.dryRunEnabled = false;
    localStorage.setItem(key, JSON.stringify(settings));
  });
}

async function openSetup(page: Page, includeLiveWarning: boolean) {
  await installTauriMock(page, {
    initialProfileFiles: ['C:\\test\\profiles\\warning-profile.jsonc'],
  });
  await seedDryRunOff(page);

  await page.addInitScript(({ includeLiveWarning, previewMessage, liveMessage }) => {
    (window as any).__LIVE_APPLY_ARGS__ = null;
    (window as any).__ENDSTATE_MOCK_ENGINE__ = {
      runEndstateStreaming: async (
        _settings: unknown,
        command: string,
        args: string[],
        onEvent: (event: unknown) => void,
        options?: { onNdjsonEvent?: (event: unknown) => void },
      ) => {
        if (command !== 'apply') {
          return { exitCode: 0, envelope: { success: true, data: {} }, ndjsonEvents: [] };
        }

        const isPreview = args.includes('--dry-run');
        if (!isPreview) (window as any).__LIVE_APPLY_ARGS__ = args;
        const item = {
          event: 'item',
          id: 'Git.Git',
          driver: 'winget',
          status: isPreview ? 'to_install' : 'installed',
          reason: isPreview ? 'would_install' : 'installed',
          name: 'Git',
        };

        options?.onNdjsonEvent?.(item);
        onEvent({ type: 'stdout', data: `${JSON.stringify(item)}\n` });

        const data = {
          counts: {
            installed: 1,
            alreadyInstalled: 0,
            failed: 0,
            skippedFiltered: 0,
          },
          items: [item],
          ...(isPreview
            ? {
                warnings: [
                  {
                    code: 'possible_duplicate',
                    message: previewMessage,
                    driver: 'choco',
                    ref: 'git.install',
                  },
                ],
              }
            : includeLiveWarning
              ? {
                  warnings: [
                    {
                      code: 'driver_advisory',
                      message: liveMessage,
                      driver: 'winget',
                      ref: 'Git.Git',
                    },
                  ],
                }
              : {}),
        };

        return {
          exitCode: 0,
          envelope: { success: true, error: null, data },
          stdout: '',
          stderr: '',
          ndjsonEvents: [item],
        };
      },
    };
  }, { includeLiveWarning, previewMessage, liveMessage });

  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.getByTestId('intent-setup').click();
  await page.getByTestId('profile-card-warning-profile').click();
  await expect(page.getByText('Preview complete')).toBeVisible({ timeout: 10_000 });
}

test.describe('Command warnings', () => {
  test('shows preview warnings and replaces them with warnings from a real apply', async ({ page }) => {
    await openSetup(page, true);

    const previewRegion = page.getByRole('region', { name: 'Command warnings' });
    await expect(previewRegion.getByText(previewMessage, { exact: true })).toBeVisible();

    await page.getByTestId('setup-flow-apply').click();

    const liveRegion = page.getByRole('region', { name: 'Command warnings' });
    await expect(liveRegion.getByText(liveMessage, { exact: true })).toBeVisible();
    await expect(page.getByText(previewMessage, { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).__LIVE_APPLY_ARGS__)).not.toContain('--dry-run');
  });

  test('clears stale preview warnings when the live envelope omits warnings', async ({ page }) => {
    await openSetup(page, false);

    await expect(page.getByText(previewMessage, { exact: true })).toBeVisible();
    await page.getByTestId('setup-flow-apply').click();

    await expect(page.getByText('Setup complete')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('region', { name: 'Command warnings' })).toHaveCount(0);
    await expect(page.getByText(previewMessage, { exact: true })).toHaveCount(0);
  });
});
