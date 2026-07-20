import { test, expect } from '@playwright/test';
import {
  seedProfile,
  removeProfile,
  seedDryRunSettings,
  dryRunApplyEnvelope,
  type SeededProfile,
} from './helpers/bridge';

/**
 * Real-engine coverage for how the GUI renders a real apply envelope.
 *
 * `engine-real-apply` proves the engine's bytes are correct; nothing proves the
 * GUI reads them correctly. This spec drives a real dry-run apply preview
 * through the UI and asserts the rendered surface reflects the engine's own
 * `summary`/`actions`: the app count, the plan status, and the friendly name —
 * with the raw winget ref kept out of the distilled row unless the engine
 * itself reported it as the name.
 *
 * Command choice: a dry-run apply *preview*. It is the real command the
 * browser-bridge UI can drive end-to-end deterministically with no host side
 * effects (nothing is installed) and no host-state coupling in the assertions:
 * the app *count* (1) and the friendly *name* are host-independent, and the
 * plan *status* (present vs to_install) is cross-checked against a ground-truth
 * envelope pulled straight from the engine rather than hard-coded.
 *
 * jq is used because the engine reports a friendly `name` ("jq") distinct from
 * its winget ref ("jqlang.jq"), which is what lets this spec prove the GUI
 * surfaces the friendly name and not the raw ref.
 */
const JQ = [{ id: 'jq', refs: { windows: 'jqlang.jq' } }];

test.describe('real-engine setup preview envelope rendering', () => {
  let seeded: SeededProfile;

  test.beforeEach(async ({ page, request }) => {
    seeded = await seedProfile(request, 'ci-real-envelope', JQ);
    await seedDryRunSettings(page);
    await page.goto('/');
    await page.getByTestId('intent-setup').click();
    await expect(page.getByTestId('setup-flow')).toBeVisible();
  });

  test.afterEach(async ({ request }) => {
    if (seeded) await removeProfile(request, seeded.path);
  });

  test('renders app count, plan status and friendly name from the real envelope', async ({ page, request }) => {
    // Ground truth straight from the engine (idempotent, no side effects).
    const envelope = await dryRunApplyEnvelope(request, seeded.path);
    expect(envelope.success).toBe(true);
    expect(envelope.data.actions).toHaveLength(1);
    const jqAction = envelope.data.actions[0];
    expect(jqAction.id).toBe('jq');
    const isPresent = jqAction.status === 'present';

    const flow = page.getByTestId('setup-flow');
    const card = page.getByTestId(`profile-card-${seeded.name}`);
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.click();

    await expect(page.getByText('Preview complete', { exact: true })).toBeVisible({ timeout: 30_000 });

    // Count comes from envelope.actions (length 1), rendered as the "1 app" chip.
    await expect(flow.getByRole('button', { name: '1 app' })).toBeVisible();

    // Plan status matches the engine's action status, not a hard-coded value.
    if (isPresent) {
      await expect(flow.getByRole('button', { name: '1 present' })).toBeVisible();
      await expect(flow.getByText('PRESENT', { exact: true })).toBeVisible();
    } else {
      await expect(flow.getByRole('button', { name: '1 to install' })).toBeVisible();
      await expect(flow.getByText('TO INSTALL', { exact: true })).toBeVisible();
    }

    // Friendly name from the engine's `name` field is surfaced…
    await expect(flow.getByText('jq', { exact: true })).toBeVisible();
    // …and the raw winget ref is not leaked beside the distilled row.
    await expect(flow.getByText('jqlang.jq')).toHaveCount(0);
  });
});
