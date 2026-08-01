import { test, expect } from '@playwright/test';
import {
  profileInspectionEnvelope,
  removeInspectionProfile,
  seedInspectionProfile,
  type SeededInspectionProfile,
} from './helpers/bridge';

test.describe('real-engine profile contents inspection', () => {
  let seeded: SeededInspectionProfile;

  test.beforeEach(async ({ request, page }) => {
    seeded = await seedInspectionProfile(request);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.getByTestId('intent-setup').click();
    await expect(page.getByTestId('setup-flow')).toBeVisible();
  });

  test.afterEach(async ({ request }) => {
    if (seeded) await removeInspectionProfile(request, seeded);
  });

  test('renders the real profile inspect inventory without selecting or previewing it', async ({ page, request }) => {
    const expected = await profileInspectionEnvelope(request, seeded.path);
    const browserInvokes: Array<{ cmd?: string; args?: { args?: string[] } }> = [];
    page.on('request', (requestEvent) => {
      if (!requestEvent.url().endsWith('/api/invoke') || requestEvent.method() !== 'POST') return;
      try {
        browserInvokes.push(requestEvent.postDataJSON());
      } catch {
        // Non-JSON browser traffic is irrelevant to the bridge command boundary.
      }
    });

    const card = page.getByTestId(`profile-card-${seeded.name}`);
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.getByRole('button', { name: `What's inside ${seeded.name}` }).click();

    const dialog = page.getByRole('dialog', { name: "What's inside" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('tab', { name: `Apps (${expected.data.apps.length})` })).toBeVisible();
    await expect(dialog.getByRole('tab', { name: `App settings (${expected.data.settingsApps.length})` })).toBeVisible();
    await expect(
      dialog.getByText(
        `Settings for ${expected.data.summary.verifiedSettingsAppCount} apps`,
        { exact: true },
      ),
    ).toBeVisible();

    const appsPanel = dialog.getByRole('tabpanel');
    const appLabels = await appsPanel.getByRole('listitem').evaluateAll((items) =>
      items.map((item) => item.firstElementChild?.textContent?.trim()),
    );
    expect(appLabels).toEqual(expected.data.apps.map((app) => app.displayName));

    const settingsTab = dialog.getByRole('tab', { name: `App settings (${expected.data.settingsApps.length})` });
    await settingsTab.click();
    const settingsPanel = dialog.getByRole('tabpanel');
    const settingsLabels = await settingsPanel.getByRole('listitem').evaluateAll((items) =>
      items.map((item) => item.firstElementChild?.textContent?.trim()),
    );
    expect(settingsLabels).toEqual(expected.data.settingsApps.map((row) => row.displayName));
    for (const row of expected.data.settingsApps.filter((row) => row.associationStatus === 'not_in_profile')) {
      await expect(settingsPanel.getByText(row.displayName, { exact: true }).locator('..')).toContainText('App not included');
    }

    if (expected.data.profile.capturedAt === null) {
      await expect(dialog.getByText('No capture date recorded', { exact: true })).toBeVisible();
    } else {
      const captured = await page.evaluate((value) => new Date(value).toLocaleString(), expected.data.profile.capturedAt);
      await expect(dialog.getByText(`captured ${captured}`, { exact: false })).toBeVisible();
    }

    const inspectionInvokes = browserInvokes.filter((entry) =>
      entry.cmd === 'endstate_exec' && entry.args?.args?.[0] === 'profile',
    );
    expect(inspectionInvokes.some((entry) => entry.args?.args?.[1] === '--json' && entry.args.args[2] === 'inspect' && entry.args.args[3] === seeded.path)).toBe(true);
    expect(browserInvokes.some((entry) => entry.cmd === 'endstate_exec' && entry.args?.args?.[0] === 'apply')).toBe(false);
    await expect(page.getByText('Preview complete', { exact: true })).toHaveCount(0);
  });
});
