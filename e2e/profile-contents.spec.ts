import { test, expect } from './fixtures/tauri';
import { goToApplyPage } from './helpers/ui-mode';

const PROFILE_PATH = 'C:\\test\\profiles\\hugo-desktop.jsonc';

test.describe("profile contents inspection", () => {
  test.use({
    tauriMockOptions: {
      initialProfileFiles: [PROFILE_PATH],
    },
  });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      // Let the app install its committed scenario-driven mock instead of the
      // fixture's generic boot mock, then select the inspection scenario.
      (window as any).__ENDSTATE_MOCK_ENGINE__ = undefined;
      (window as any).__ENDSTATE_E2E_SCENARIO__ = 'profile_inspect_ok';
      (window as any).__ENDSTATE_E2E_COMMANDS__ = [];
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await goToApplyPage(page);
  });

  test('inspects a discovered profile without selecting or previewing it', async ({ page }) => {
    const card = page.getByTestId('profile-card-hugo-desktop');
    await expect(card).toBeVisible();
    await expect(card.getByRole('button', { name: 'Select' })).toBeVisible();

    await card.getByRole('button', { name: "What's inside hugo-desktop" }).click();

    const dialog = page.getByRole('dialog', { name: "What's inside" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('72 apps', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Settings for 8 apps', { exact: true })).toBeVisible();

    const appsTab = dialog.getByRole('tab', { name: 'Apps (72)' });
    const settingsTab = dialog.getByRole('tab', { name: 'App settings (8)' });
    await expect(appsTab).toHaveAttribute('aria-selected', 'true');

    await appsTab.press('ArrowRight');
    await expect(settingsTab).toHaveAttribute('aria-selected', 'true');
    await expect(settingsTab).toBeFocused();
    await settingsTab.press('Home');
    await expect(appsTab).toHaveAttribute('aria-selected', 'true');
    await appsTab.press('End');
    await expect(settingsTab).toHaveAttribute('aria-selected', 'true');

    await appsTab.click();
    const appsSearch = dialog.getByRole('searchbox', { name: 'Search apps' });
    await appsSearch.fill('hidden-package-ref');
    await expect(dialog.getByText('Cursor', { exact: true })).toBeVisible();
    await expect(dialog.getByText('72 apps', { exact: true })).toBeVisible();

    await settingsTab.click();
    const settingsSearch = dialog.getByRole('searchbox', { name: 'Search app settings' });
    await settingsSearch.fill('hidden-module-id');
    await expect(dialog.getByText('Cursor settings', { exact: true })).toBeVisible();
    const settingsPanel = dialog.getByRole('tabpanel', { includeHidden: true }).nth(1);
    await expect(settingsPanel.getByRole('listitem')).toHaveCount(1);

    await appsTab.click();
    await expect(appsSearch).toHaveValue('hidden-package-ref');
    await settingsTab.click();
    await expect(settingsSearch).toHaveValue('hidden-module-id');
    await settingsSearch.fill('');
    await expect(settingsPanel.getByRole('listitem')).toHaveCount(8);
    await expect(dialog.getByText('Retired App settings', { exact: true })).toBeVisible();
    await expect(dialog.getByText('App not included', { exact: true })).toBeVisible();

    await expect(dialog.getByText('1 captured entry', { exact: true })).toHaveCount(0);
    await expect(dialog.getByText('apps.hidden-module-id', { exact: true })).toHaveCount(0);
    await expect(dialog.getByText(PROFILE_PATH, { exact: true })).toHaveCount(0);
    await expect(dialog.getByText('Some settings inventory could not be verified.', { exact: true })).toBeVisible();

    await dialog.getByRole('button', { name: 'Close', exact: true }).first().click();
    await card.getByRole('button', { name: "What's inside hugo-desktop" }).click();
    await expect(dialog.getByRole('searchbox', { name: 'Search apps' })).toHaveValue('');

    const commands = await page.evaluate(() => (window as any).__ENDSTATE_E2E_COMMANDS__);
    expect(commands).toContainEqual({ command: 'profile', args: ['inspect', PROFILE_PATH] });
    expect(commands.some((entry: { command: string }) =>
      ['apply', 'preview', 'detect'].includes(entry.command),
    )).toBe(false);
    await expect(page.getByText('Preview complete', { exact: true })).toHaveCount(0);
  });
});
