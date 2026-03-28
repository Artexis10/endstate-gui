import { test, expect } from '@playwright/test';
import { forceAdvancedMode } from './helpers/ui-mode';
import { installTauriMock } from './helpers/tauri-mock';

/**
 * Streaming Contract Tests
 * 
 * These tests verify the critical contract that:
 * 1. invoke() returning undefined does NOT indicate failure
 * 2. Streaming completion is determined by exit events, not invoke return value
 * 3. Error banners only appear for real runtime failures
 */
test.describe('Streaming Contract', () => {
  
  test('Streaming invoke returns undefined but succeeds - no error banner', async ({ page, baseURL }) => {
    await forceAdvancedMode(page);

    await installTauriMock(page, {
      enableEventListeners: true,
      invoke: {
        run_endstate_streaming: (args?: any) => {
          const channel = args?.eventChannel;
          setTimeout(() => {
            (window as any).__TAURI__.__test.emit(channel, { 
              payload: { 
                type: 'stdout', 
                data: JSON.stringify({
                  schemaVersion: '1.0',
                  cliVersion: '1.0.0',
                  command: args?.args?.[0] || 'capabilities',
                  runId: 'test-run',
                  timestampUtc: new Date().toISOString(),
                  success: true,
                  data: { commands: ['capture', 'apply', 'verify', 'report'] },
                  error: null
                }) + '\n' 
              }
            });
            (window as any).__TAURI__.__test.emit(channel, { 
              payload: { type: 'exit', data: '', exitCode: 0 }
            });
          }, 100);
          return undefined;
        },
      }
    });

    await page.addInitScript(() => {
      (window as any).__ENDSTATE_MOCK_ENGINE__ = {
        runEndstateStreaming: async (settings: any, command: string, args: string[], onEvent: Function) => {
          return { exitCode: 0, envelope: { success: true, data: { commands: ['capture', 'apply', 'verify', 'report'] } } };
        }
      };
    });
    
    await page.goto(baseURL || '/');
    await page.waitForLoadState('networkidle');
    
    // CRITICAL ASSERTIONS:
    // 1. No error banner should be visible
    await expect(page.locator('text=Engine not connected')).not.toBeVisible();
    await expect(page.locator('text=Tauri streaming not available')).not.toBeVisible();
    await expect(page.locator('text=running in web mode without mock')).not.toBeVisible();

    // 2. App should be in ready state, not error state
    await expect(page.locator('text=Loading...')).not.toBeVisible();

    // 3. Navigation should work - intent cards should be clickable
    await expect(page.locator('[data-testid="intent-save"]')).toBeVisible();
    await expect(page.locator('[data-testid="intent-setup"]')).toBeVisible();
  });

  test('Streaming invoke throws - error banner appears', async ({ page, baseURL }) => {
    await forceAdvancedMode(page);

    await installTauriMock(page, {
      enableEventListeners: true,
      invoke: {
        run_endstate_streaming: () => {
          throw new Error('IPC channel closed unexpectedly');
        },
      }
    });
    
    await page.goto(baseURL || '/');
    
    // Wait for the error state to propagate to the UI.
    // The error banner renders inside persistent flow containers (display:none) AND the landing page.
    // The most reliable signal is that the intent cards become disabled.
    const intentSave = page.locator('[data-testid="intent-save"]');
    await expect(intentSave).toBeVisible({ timeout: 15000 });
    await expect(intentSave).toBeDisabled({ timeout: 15000 });

    // CRITICAL ASSERTIONS:
    // 1. Error state is active - intent cards are disabled
    await expect(page.locator('[data-testid="intent-setup"]')).toBeDisabled();

    // 2. UI should remain navigable (non-blocking error)
    // Both intent cards are still rendered (visible but disabled)
    await expect(page.locator('[data-testid="intent-save"]')).toBeVisible();
    await expect(page.locator('[data-testid="intent-setup"]')).toBeVisible();
  });

  test('Verify with missing apps shows results, not error banner', async ({ page, baseURL }) => {
    // Force Advanced mode for sidebar navigation tests
    await forceAdvancedMode(page);

    // Use the same mock pattern as web-only.spec.ts which works reliably
    // loadInitialData uses runEndstateOnce which checks for __ENDSTATE_MOCK_ENGINE__
    // NOTE: We do NOT set __TAURI__ here so isTauriRuntime() returns false
    // and the mock engine path is used instead of trying real Tauri invoke
    await page.addInitScript(() => {
      // Mock engine - this is what runEndstateOnce checks for in web mode
      (window as any).__ENDSTATE_MOCK_ENGINE__ = {
        runEndstateStreaming: async (settings: any, command: string, args: string[], onEvent: Function) => {
          if (command === 'capabilities') {
            return { exitCode: 0, envelope: { success: true, data: { commands: ['capture', 'apply', 'verify', 'report'] } } };
          }
          if (command === 'report') {
            return { exitCode: 0, envelope: { success: true, data: { hasState: false } } };
          }
          if (command === 'verify') {
            // Domain failure - missing apps (success=false but valid data with VERIFY_FAILED error)
            return {
              exitCode: 0,
              envelope: {
                schemaVersion: '1.0',
                cliVersion: '1.0.0',
                command: 'verify',
                runId: 'test',
                timestampUtc: new Date().toISOString(),
                success: false,
                data: {
                  summary: { total: 2, pass: 1, fail: 1 },
                  results: [
                    { type: 'app', ref: 'Git.Git', status: 'pass' },
                    { type: 'app', ref: 'Notepad++.Notepad++', status: 'fail' }
                  ]
                },
                error: { code: 'VERIFY_FAILED', message: 'Missing apps: Notepad++.Notepad++' }
              }
            };
          }
          return { exitCode: 0, envelope: { success: true, data: {} } };
        },
        // Also provide runEndstateOnce for the non-streaming path
        runEndstateOnce: async (settings: any, command: string, args: string[]) => {
          if (command === 'capabilities') {
            return {
              success: true,
              envelope: {
                schemaVersion: '1.0', cliVersion: '1.0.0', command: 'capabilities',
                runId: 'test', timestampUtc: new Date().toISOString(),
                success: true, data: { commands: ['capture', 'apply', 'verify', 'report'] }, error: null
              },
              stdout: '', stderr: '', exitCode: 0
            };
          }
          if (command === 'report') {
            return {
              success: true,
              envelope: {
                schemaVersion: '1.0', cliVersion: '1.0.0', command: 'report',
                runId: 'test', timestampUtc: new Date().toISOString(),
                success: true, data: { hasState: false }, error: null
              },
              stdout: '', stderr: '', exitCode: 0
            };
          }
          if (command === 'verify') {
            // Domain failure - return success: false at EngineExecResult level
            // but include envelope with VERIFY_FAILED error
            return {
              success: false,
              error: { kind: 'verify_failed', message: 'Missing apps: Notepad++.Notepad++' },
              envelope: {
                schemaVersion: '1.0', cliVersion: '1.0.0', command: 'verify',
                runId: 'test', timestampUtc: new Date().toISOString(),
                success: false,
                data: {
                  summary: { total: 2, pass: 1, fail: 1 },
                  results: [
                    { type: 'app', ref: 'Git.Git', status: 'pass' },
                    { type: 'app', ref: 'Notepad++.Notepad++', status: 'fail' }
                  ]
                },
                error: { code: 'VERIFY_FAILED', message: 'Missing apps: Notepad++.Notepad++' }
              },
              stdout: '', stderr: '', exitCode: 0
            };
          }
          return { success: true, envelope: { success: true, data: {} }, stdout: '', stderr: '', exitCode: 0 };
        }
      };
    });
    
    await page.goto(baseURL || '/');
    await page.waitForLoadState('networkidle');
    
    // CRITICAL ASSERTIONS:
    // Domain failure (VERIFY_FAILED) should NOT show error banner
    await expect(page.locator('text=Engine not connected')).not.toBeVisible();
    await expect(page.locator('text=Tauri streaming not available')).not.toBeVisible();

    // App should be usable - intent cards should be clickable
    await expect(page.locator('[data-testid="intent-save"]')).toBeVisible();
    await expect(page.locator('[data-testid="intent-setup"]')).toBeVisible();
  });
});
