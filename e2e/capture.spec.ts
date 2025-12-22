import { test, expect, _electron as electron } from '@playwright/test';
import { join } from 'path';

test('Capture happy-path with mocked streaming', async () => {
  const electronApp = await electron.launch({
    args: ['.'],
    cwd: join(process.cwd(), 'src-tauri'),
  });

  const window = await electronApp.firstWindow();
  await window.waitForLoadState('domcontentloaded');

  // Inject mock engine before any operations
  await window.evaluate(() => {
    // Mock streaming output lines
    const mockCaptureLines = [
      '[OK] Discord.Discord (driver: winget)',
      '[OK] Google.Chrome (driver: winget)',
      '[OK] Microsoft.VisualStudioCode (driver: winget)',
      '[SKIP] OldApp.Name (driver: chocolatey)',
      '[SKIP] AnotherSkipped',
      '[OK]     Manifest saved: C:\\Users\\test\\Documents\\Autosuite\\Setups\\setup_2025-12-23_01-00-00.jsonc',
      'Summary: 62 succeeded, 8 skipped, 0 failed',
      'Capture complete!',
      '{"schemaVersion":"1.0","cliVersion":"0.0.0-dev+test","command":"capture","timestampUtc":"2025-12-23T01:00:00.0000000Z","success":true,"data":{"isExample":null,"sanitized":false,"outputPath":"C:\\\\Users\\\\test\\\\Documents\\\\Autosuite\\\\Setups\\\\setup_2025-12-23_01-00-00.jsonc"},"error":null}'
    ];

    window.__AUTOSUITE_MOCK_ENGINE__ = {
      runAutosuiteStreaming: async (settings: any, command: string, args: string[], onEvent: any) => {
        // Simulate streaming output
        for (const line of mockCaptureLines) {
          await new Promise(resolve => setTimeout(resolve, 20));
          onEvent({ type: 'stdout', data: line + '\n' });
        }
        
        // Simulate exit
        onEvent({ type: 'exit', data: '', exitCode: 0 });

        return {
          envelope: {
            schemaVersion: '1.0',
            cliVersion: '0.0.0-dev+test',
            command: 'capture',
            timestampUtc: '2025-12-23T01:00:00.0000000Z',
            success: true,
            data: {
              isExample: null,
              sanitized: false,
              outputPath: 'C:\\Users\\test\\Documents\\Autosuite\\Setups\\setup_2025-12-23_01-00-00.jsonc'
            },
            error: null
          },
          exitCode: 0,
          stdout: mockCaptureLines.join('\n'),
          stderr: ''
        };
      }
    };
  });

  // Navigate to Capture page
  const captureNavButton = window.locator('button:has-text("Capture")');
  await captureNavButton.click();

  // Wait for page to load
  await expect(window.locator('h2:has-text("Capture machine")')).toBeVisible();

  // Click "Capture machine" button
  const captureMachineButton = window.locator('button:has-text("Capture machine")');
  await captureMachineButton.click();

  // Verify live progress is visible in main activity area (NOT only in technical details)
  // Look for "Processing: <appId>" text
  await expect(window.locator('text=/Processing:.*Discord\\.Discord/i')).toBeVisible({ timeout: 5000 });

  // Verify technical details is closed by default
  const technicalDetails = window.locator('details:has-text("Technical details")');
  await expect(technicalDetails).toBeVisible();
  const isOpen = await technicalDetails.evaluate((el: HTMLDetailsElement) => el.open);
  expect(isOpen).toBe(false);

  // Wait for modal to appear
  await expect(window.locator('[role="dialog"]')).toBeVisible({ timeout: 10000 });

  // Verify modal shows correct counts (62/8/0)
  await expect(window.locator('text=/62.*succeeded/i')).toBeVisible();
  await expect(window.locator('text=/8.*skipped/i')).toBeVisible();
  await expect(window.locator('text=/0.*failed/i')).toBeVisible();

  // Verify modal shows output path
  await expect(window.locator('text=/setup_2025-12-23_01-00-00\\.jsonc/i')).toBeVisible();

  await electronApp.close();
});
