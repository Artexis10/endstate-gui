import { test, expect, _electron as electron } from '@playwright/test';
import { join } from 'path';
import { mkdirSync, writeFileSync, rmSync } from 'fs';

const TEMP_MANIFEST_DIR = join(process.cwd(), 'temp-test-manifests');
const TEST_MANIFEST_PATH = join(TEMP_MANIFEST_DIR, 'TestProfile.jsonc');

test.beforeAll(() => {
  mkdirSync(TEMP_MANIFEST_DIR, { recursive: true });
  
  const dummyManifest = {
    "$schema": "https://example.com/schema.json",
    "name": "TestProfile",
    "packages": []
  };
  
  writeFileSync(TEST_MANIFEST_PATH, JSON.stringify(dummyManifest, null, 2));
});

test.afterAll(() => {
  rmSync(TEMP_MANIFEST_DIR, { recursive: true, force: true });
});

test('smoke test: configure settings and run check setup', async () => {
  const electronApp = await electron.launch({
    args: ['.'],
    cwd: join(process.cwd(), 'src-tauri'),
  });

  const window = await electronApp.firstWindow();
  await window.waitForLoadState('domcontentloaded');

  await expect(window.locator('h1')).toContainText('Autosuite');

  const settingsButton = window.locator('button:has-text("Settings")');
  if (await settingsButton.isVisible()) {
    await settingsButton.click();
  } else {
    const openSettingsButton = window.locator('button:has-text("Open Settings")');
    await openSettingsButton.click();
  }

  await expect(window.locator('h2:has-text("Settings")')).toBeVisible();

  const manifestInput = window.locator('input[placeholder*="manifests"]');
  await manifestInput.fill(TEMP_MANIFEST_DIR);

  const saveButton = window.locator('button:has-text("Save")');
  await saveButton.click();

  await expect(window.locator('select#profile-select')).toBeVisible();

  const profileSelect = window.locator('select#profile-select');
  await profileSelect.selectOption('TestProfile');

  const checkSetupButton = window.locator('button:has-text("Check setup")');
  await checkSetupButton.click();

  await window.waitForTimeout(2000);

  const machineStatusCard = window.locator('.info-card:has-text("Machine status")');
  await expect(machineStatusCard).toBeVisible();

  await electronApp.close();
});
