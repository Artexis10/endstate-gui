import { test, expect } from '@playwright/test';
import { installMockEngine } from './helpers/mock-engine';
import { openApp, previewTestProfile } from './helpers/ui-mode';

/**
 * Setup Flow Tests -- verifies the intent-based setup flow:
 * Landing -> "Set up this computer" -> profile selection -> auto-preview -> results
 *
 * Key mock patterns:
 * - Use initialProfileFiles (serializable) for profile discovery
 * - Use envelope.data.counts for summary totals (source of truth)
 * - NDJSON events need event:'item' and EngineItemStatus values (to_install/present/installed/failed)
 */

test.describe('Setup Flow - All Already Installed', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await installMockEngine(page, {
      readsDryRunFlag: false,
      apps: [
        { id: 'Discord.Discord', name: 'Discord', status: 'present', reason: 'already_installed' },
        { id: 'Google.Chrome', name: 'Chrome', status: 'present', reason: 'already_installed' },
      ],
    });
    await openApp(page, baseURL);
  });

  test('setup flow loads with profile list and back button', async ({ page }) => {
    await page.locator('[data-testid="intent-setup"]').click();
    await expect(page.locator('[data-testid="setup-flow"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="profile-card-test-profile"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="setup-flow-back"]')).toBeVisible();
  });

  test('selecting a profile auto-starts preview and shows results', async ({ page }) => {
    await previewTestProfile(page);
    await expect(page.getByRole('button', { name: /^\d+ present$/ })).toBeVisible();
  });

  test('shows "all apps already present" when nothing to install', async ({ page }) => {
    await previewTestProfile(page);
    await expect(page.getByRole('button', { name: /^\d+ present$/ })).toBeVisible();
    // No "Apply changes" button when nothing to install
    await expect(page.locator('[data-testid="setup-flow-apply"]')).not.toBeVisible();
  });
});

test.describe('Setup Flow - With Failures', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await installMockEngine(page, {
      apps: [
        { id: 'Discord.Discord', name: 'Discord', installs: true },
        { id: 'Google.Chrome', name: 'Chrome', status: 'present', reason: 'already_installed' },
        { id: 'BrokenApp.App', name: 'Broken App', status: 'failed', reason: 'install_failed' },
      ],
    });
    await openApp(page, baseURL);
  });

  test('preview shows results even when some items would fail', async ({ page }) => {
    await previewTestProfile(page);
    await expect(page.locator('text=/to install/i').first()).toBeVisible();
  });
});

test.describe('Setup Flow - Pending Installs (Preview)', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await installMockEngine(page, {
      apps: [
        { id: 'Notepad++.Notepad++', name: 'Notepad++', installs: true },
        { id: 'Google.Chrome', name: 'Chrome', status: 'present', reason: 'already_installed' },
      ],
    });
    await openApp(page, baseURL);
  });

  test('shows Apply changes button when preview finds apps to install', async ({ page }) => {
    await previewTestProfile(page);
    await expect(page.locator('text=/to install/i').first()).toBeVisible();
    await expect(page.locator('[data-testid="setup-flow-apply"]')).toBeVisible();
  });
});
