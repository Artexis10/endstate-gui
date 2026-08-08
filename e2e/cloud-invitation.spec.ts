import { expect, test, type Page } from '@playwright/test';
import { installTauriMock } from './helpers/tauri-mock';

/**
 * Post-capture Endstate Cloud invitation — appears once, never again.
 *
 * The unit suite (`save-flow-cloud-invitation.test.tsx`,
 * `settings.test.ts`) covers each eligibility condition and the
 * record-before-present ordering. What only a browser can prove is the part the
 * whole promise rests on: the decision survives a reload through real
 * namespaced localStorage, so a second capture on a real install never sees the
 * invitation again. PRINCIPLES.md §1 — "There will never be a nag screen."
 *
 * Engine mock shape follows `capture-artifact-flow.spec.ts`.
 */

const INVITATION = 'save-flow-cloud-invitation';

async function installCaptureMock(page: Page) {
  await page.addInitScript(() => {
    (window as any).__ENDSTATE_MOCK_ENGINE__ = {
      runEndstateStreaming: async (
        _settings: unknown,
        command: string,
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
            ndjsonEvents: [],
          };
        }
        return { exitCode: 0, envelope: { success: true, data: {} }, ndjsonEvents: [] };
      },
    };
  });
}

/** Capture, then save to file, landing on the saved completion card. */
async function captureAndSave(page: Page) {
  await page.getByTestId('intent-save').click();
  await page.getByTestId('save-flow-start-scan').click();
  await expect(page.getByTestId('save-flow-save-file')).toBeVisible();

  // The web/browser save path triggers a download rather than an OS dialog.
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('save-flow-save-file').click();
  await downloadPromise;
  await expect(page.getByText('Backup saved')).toBeVisible();
}

test.describe('post-capture cloud invitation', () => {
  test.beforeEach(async ({ page }) => {
    await installTauriMock(page, { allowUnknownInvokes: true });
    await installCaptureMock(page);
  });

  test('offers Endstate Cloud once, then never again after a reload', async ({ page, baseURL }) => {
    await page.goto(baseURL || '/');
    await page.waitForLoadState('networkidle');

    await captureAndSave(page);

    const invitation = page.getByTestId(INVITATION);
    await expect(invitation).toBeVisible();
    await expect(invitation).toContainText('Your setup is saved locally');
    await expect(invitation).toContainText('Keep future versions protected automatically');
    // Never a price — the GUI has no reliable price source.
    await expect(invitation).not.toContainText('€');

    // The local outcome is complete without answering: the completion actions
    // remain available alongside the invitation, which blocks nothing.
    await expect(page.getByRole('button', { name: 'Back to home' })).toBeVisible();

    await page.getByTestId('save-flow-cloud-invitation-dismiss').click();
    await expect(invitation).not.toBeVisible();

    // The decision is durable: a fresh app load and a fresh capture must not
    // re-offer it.
    await page.reload();
    await page.waitForLoadState('networkidle');

    await captureAndSave(page);
    await expect(page.getByTestId(INVITATION)).toHaveCount(0);
  });

  test('does not re-offer after a reload even when the first offer was never answered', async ({ page, baseURL }) => {
    // Record-before-present: the flag is written the moment the card is shown,
    // so an unanswered invitation (crash, force-quit) is spent, not pending.
    await page.goto(baseURL || '/');
    await page.waitForLoadState('networkidle');

    await captureAndSave(page);
    await expect(page.getByTestId(INVITATION)).toBeVisible();

    await page.reload();
    await page.waitForLoadState('networkidle');

    await captureAndSave(page);
    await expect(page.getByTestId(INVITATION)).toHaveCount(0);
  });
});
