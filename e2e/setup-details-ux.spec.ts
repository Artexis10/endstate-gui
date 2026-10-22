import { test, expect } from '@playwright/test';
import { installMockEngine } from './helpers/mock-engine';
import { openApp, previewTestProfile } from './helpers/ui-mode';

/**
 * E2E tests for Setup Details UX:
 * - Preview results show inline in SetupFlow
 * - Status labels are readable and not truncated
 * - Failure states render correctly
 */

// These mocks stream the same items on every run and never read --dry-run.
const ENGINE = { capabilities: ['capture', 'apply', 'report'], readsDryRunFlag: false };

test.describe('Setup Flow UX - Already Installed Results', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await installMockEngine(page, {
      ...ENGINE,
      apps: [{ id: 'App1', name: 'App1', status: 'present', reason: 'already_installed' }],
    });
    await openApp(page, baseURL);
  });

  test('Preview results show inline with readable status labels', async ({ page }) => {
    await previewTestProfile(page);
    await expect(page.getByRole('button', { name: /^\d+ present$/ })).toBeVisible();
    await expect(page.locator('text=App1').first()).toBeVisible();
  });
});

test.describe('Setup Flow UX - Would Install Results', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await installMockEngine(page, {
      ...ENGINE,
      apps: [{ id: 'TestApp.App', name: 'TestApp', status: 'to_install', reason: 'would_install' }],
    });
    await openApp(page, baseURL);
  });

  test('preview shows "to install" text without truncation', async ({ page }) => {
    await previewTestProfile(page);
    await expect(page.locator('text=/to install/i').first()).toBeVisible();
    // Should NOT show truncated status text
    await expect(page.locator('text=WOULD I')).not.toBeVisible();
    await expect(page.locator('[data-testid="setup-flow-apply"]')).toBeVisible();
  });
});

test.describe('Setup Flow UX - Failure Status', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await installMockEngine(page, {
      ...ENGINE,
      applyOutcome: { exitCode: 1, success: true },
      apps: [{ id: 'FailingApp.App', name: 'Failing App', status: 'failed', reason: 'install_failed', message: 'Package not found' }],
    });
    await openApp(page, baseURL);
  });

  test('Preview shows completion even when items fail', async ({ page }) => {
    await page.locator('[data-testid="intent-setup"]').click();
    await expect(page.locator('[data-testid="setup-flow"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="profile-card-test-profile"]').click();
    // Should reach a terminal state without hanging
    await expect(
      page.locator('text=Preview complete').or(page.locator('text=/failed/i')).first()
    ).toBeVisible({ timeout: 10000 });
  });
});
