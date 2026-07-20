import { test, expect } from '@playwright/test';
import {
  seedProfile,
  removeProfile,
  seedDryRunSettings,
  type SeededProfile,
} from './helpers/bridge';

/**
 * Real-engine coverage for the July "Setup complete" defect (#163).
 *
 * The GUI shipped with dryRunEnabled defaulting to true. The primary Apply
 * action therefore ran `apply --dry-run`, installed nothing, and the results
 * screen still read "Setup complete". The engine had reported `dryRun: true`
 * on every apply envelope the whole time — nothing in the GUI read it.
 *
 * No mock stands in for the engine here: a real `endstate.exe` plans a real
 * dry-run apply over the bridge, and this spec asserts the GUI discloses the
 * dry run rather than claiming an install that never happened. The mocked e2e
 * suite structurally could not catch this class — it asserted the GUI's own
 * reading of a hand-authored envelope shape.
 *
 * WinDirStat is used because it is a niche disk-usage GUI tool that a clean CI
 * runner (and a typical dev machine) will not have installed, so the engine
 * plans it as `to_install`. That is what makes the Apply button appear — the
 * setup flow only offers Apply when there is work to do (installed > 0). It is
 * never actually installed: dryRunEnabled keeps every apply a dry run, so this
 * spec triggers no winget install and no UAC prompt.
 */
const WINDIRSTAT = [{ id: 'windirstat', refs: { windows: 'WinDirStat.WinDirStat' } }];

test.describe('real-engine setup dry-run disclosure', () => {
  let seeded: SeededProfile;

  test.beforeEach(async ({ page, request }) => {
    seeded = await seedProfile(request, 'ci-real-disclosure', WINDIRSTAT);
    await seedDryRunSettings(page);
    await page.goto('/');
    await page.getByTestId('intent-setup').click();
    await expect(page.getByTestId('setup-flow')).toBeVisible();
  });

  test.afterEach(async ({ request }) => {
    if (seeded) await removeProfile(request, seeded.path);
  });

  test('a dry-run apply is disclosed as a preview, never as a completed install', async ({ page }) => {
    const card = page.getByTestId(`profile-card-${seeded.name}`);
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.click();

    // The auto-preview (a real `apply --dry-run`) resolves to preview-done.
    await expect(page.getByText('Preview complete', { exact: true })).toBeVisible({ timeout: 30_000 });

    // WinDirStat is absent → planned to_install → the Apply button is offered.
    const apply = page.getByTestId('setup-flow-apply');
    await expect(apply).toBeEnabled({ timeout: 15_000 });
    await apply.click();

    // The primary apply ran with --dry-run (dryRunEnabled). It must disclose
    // that nothing was installed — the exact regression #163 fixed.
    await expect(
      page.getByText('Preview complete — nothing was installed'),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/would be installed/i)).toBeVisible();

    // The defect: presenting a dry run as a finished install. That claim must
    // not appear anywhere on the results screen.
    await expect(page.getByText('Setup complete', { exact: true })).toHaveCount(0);
    // And it must not have reported real installs ("1 installed, ...").
    await expect(page.getByText(/^\d+ installed,/)).toHaveCount(0);
  });
});
