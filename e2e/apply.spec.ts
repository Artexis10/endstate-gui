import { test, expect, _electron as electron } from '@playwright/test';
import { join } from 'path';
import { mkdirSync, writeFileSync, rmSync } from 'fs';

const TEMP_MANIFEST_DIR = join(process.cwd(), 'temp-test-apply-manifests');
const TEST_MANIFEST_PATH = join(TEMP_MANIFEST_DIR, 'TestApplyProfile.jsonc');

test.beforeAll(() => {
  mkdirSync(TEMP_MANIFEST_DIR, { recursive: true });
  
  const dummyManifest = {
    "$schema": "https://example.com/schema.json",
    "name": "TestApplyProfile",
    "packages": [
      { "id": "Discord.Discord", "driver": "winget" },
      { "id": "Google.Chrome", "driver": "winget" }
    ]
  };
  
  writeFileSync(TEST_MANIFEST_PATH, JSON.stringify(dummyManifest, null, 2));
});

test.afterAll(() => {
  rmSync(TEMP_MANIFEST_DIR, { recursive: true, force: true });
});

test('Apply happy-path with mocked streaming', async () => {
  const electronApp = await electron.launch({
    args: ['.'],
    cwd: join(process.cwd(), 'src-tauri'),
  });

  const window = await electronApp.firstWindow();
  await window.waitForLoadState('domcontentloaded');

  // Inject mock engine
  await window.evaluate(() => {
    let callCount = 0;
    
    window.__AUTOSUITE_MOCK_ENGINE__ = {
      runAutosuiteStreaming: async (settings: any, command: string, args: string[], onEvent: any) => {
        callCount++;
        
        // Mock capabilities
        if (command === 'capabilities') {
          return {
            envelope: {
              success: true,
              data: {
                commands: ['capture', 'apply', 'verify', 'report'],
                version: '0.0.0-dev+test'
              }
            },
            exitCode: 0,
            stdout: '',
            stderr: ''
          };
        }
        
        // Mock report
        if (command === 'report') {
          return {
            envelope: {
              success: true,
              data: {
                hasState: false,
                lastApplied: null,
                lastVerify: null
              }
            },
            exitCode: 0,
            stdout: '',
            stderr: ''
          };
        }
        
        // Mock verify
        if (command === 'verify') {
          // Simulate streaming output
          await new Promise(resolve => setTimeout(resolve, 100));
          
          return {
            envelope: {
              success: true,
              data: {
                summary: {
                  total: 10,
                  okCount: 7,
                  missingCount: 2,
                  versionMismatchCount: 1
                },
                results: [
                  { id: 'App1', status: 'ok' },
                  { id: 'App2', status: 'missing' },
                  { id: 'App3', status: 'version-mismatch' }
                ]
              }
            },
            exitCode: 0,
            stdout: '',
            stderr: ''
          };
        }
        
        return {
          envelope: { success: true, data: {} },
          exitCode: 0,
          stdout: '',
          stderr: ''
        };
      }
    };
  });

  // Configure settings
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

  // Navigate to Apply page
  const applyButton = window.locator('button:has-text("Apply")');
  await applyButton.click();

  // Select profile
  await expect(window.locator('select#profile-select')).toBeVisible();
  const profileSelect = window.locator('select#profile-select');
  await profileSelect.selectOption('TestApplyProfile');

  // Click "Check this computer"
  const checkButton = window.locator('button:has-text("Check")');
  await checkButton.click();

  // Verify 3-step timeline transitions
  // Step 1: Scanning
  await expect(window.locator('text=/Scanning installed applications/i')).toBeVisible({ timeout: 5000 });
  
  // Step 2: Comparing
  await expect(window.locator('text=/Comparing to setup/i')).toBeVisible({ timeout: 5000 });
  
  // Step 3: Result ready
  await expect(window.locator('text=/Result ready/i')).toBeVisible({ timeout: 5000 });

  // Wait for modal
  await expect(window.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });

  // Close modal
  const closeButton = window.locator('button:has-text("Close")');
  await closeButton.click();

  // Verify Last Run section shows the latest run
  await expect(window.locator('text=/Last Run/i')).toBeVisible();
  await expect(window.locator('text=/verify/i')).toBeVisible();
  await expect(window.locator('text=/7/i')).toBeVisible(); // okCount

  // Run check again to verify no duplicate rows
  await checkButton.click();
  await expect(window.locator('text=/Scanning installed applications/i')).toBeVisible({ timeout: 5000 });
  await expect(window.locator('text=/Result ready/i')).toBeVisible({ timeout: 5000 });

  // Verify activity list doesn't have duplicates (should have 3 items, not 6)
  const activityItems = window.locator('[data-testid="activity-item"]');
  const count = await activityItems.count();
  expect(count).toBeLessThanOrEqual(3);

  // Reload page to verify Last Run persists
  await window.reload();
  await window.waitForLoadState('domcontentloaded');

  // Navigate back to Apply page
  const applyButtonAfterReload = window.locator('button:has-text("Apply")');
  await applyButtonAfterReload.click();

  // Verify Last Run still shows
  await expect(window.locator('text=/Last Run/i')).toBeVisible();
  await expect(window.locator('text=/verify/i')).toBeVisible();

  await electronApp.close();
});
