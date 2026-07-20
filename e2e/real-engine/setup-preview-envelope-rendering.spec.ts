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
 * `summary`/`actions`: the app count, the plan status, and the per-app name.
 *
 * Command choice: a dry-run apply *preview*. It is the real command the
 * browser-bridge UI can drive end-to-end deterministically with no host side
 * effects (nothing is installed). Every assertion binds to a ground-truth
 * envelope pulled straight from the engine over the bridge, never to a
 * host-dependent literal — the whole point of the lane. The app *count* (1) is
 * host-independent; the plan *status* (present vs to_install) and the row
 * *name* are whatever the engine actually reported for this host.
 *
 * On name semantics: the engine only resolves a friendly display name once a
 * package is present/installed. A to_install dry-run row carries the winget ref
 * as its name (jq present → name "jq"; jq absent → name "jqlang.jq"). So the
 * assertion reads the engine's reported name and requires the UI to render
 * exactly that. The #163-class invariant — a raw ref must never appear beside a
 * row when the engine DID provide a distinct friendly name — is asserted only
 * when the envelope actually carries one (name !== ref).
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

  test('renders app count, plan status and the engine-reported name from the real envelope', async ({ page, request }) => {
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

    // The row renders the engine's own reported name for this app, verbatim —
    // "jq" on a host where it is present, "jqlang.jq" on a clean host where the
    // engine has no friendly name yet. Assert exactly what the envelope carries.
    await expect(flow.getByText(jqAction.name, { exact: true })).toBeVisible();

    // #163-class invariant: when the engine DID resolve a distinct friendly name,
    // the raw winget ref must not leak beside the distilled row. When name === ref
    // (a to_install dry run), the engine itself reports the ref, so showing it is
    // faithful rendering, not a leak — nothing to assert.
    if (jqAction.name !== jqAction.ref) {
      await expect(flow.getByText(jqAction.ref)).toHaveCount(0);
    }
  });
});
