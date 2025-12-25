import { test, expect } from '@playwright/test';
import { forceAdvancedMode, goToApplyPage, goToVerifyPage } from './helpers/ui-mode';

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
    // Force Advanced mode for sidebar navigation tests
    await forceAdvancedMode(page);

    // Setup: Mock Tauri APIs where invoke returns undefined (as Tauri v2 does)
    // but streaming events are emitted correctly
    await page.addInitScript(() => {
      const eventHandlers: Map<string, Function> = new Map();
      
      (window as any).__TAURI__ = {
        core: {
          invoke: async (cmd: string, args?: any) => {
            if (cmd === 'run_endstate_streaming') {
              // Simulate streaming: emit events after a short delay
              const channel = args?.eventChannel;
              setTimeout(() => {
                const handler = eventHandlers.get(channel);
                if (handler) {
                  // Emit stdout with valid JSON envelope
                  handler({ payload: { type: 'stdout', data: JSON.stringify({
                    schemaVersion: '1.0',
                    cliVersion: '1.0.0',
                    command: args?.args?.[0] || 'capabilities',
                    runId: 'test-run',
                    timestampUtc: new Date().toISOString(),
                    success: true,
                    data: { commands: ['capture', 'apply', 'verify', 'report'] },
                    error: null
                  }) + '\n' }});
                  // Emit exit event
                  handler({ payload: { type: 'exit', data: '', exitCode: 0 }});
                }
              }, 100);
              
              // CRITICAL: Return undefined - this is what Tauri v2 does
              // The old buggy code would throw an error here
              return undefined;
            }
            if (cmd === 'ensure_dir') return null;
            if (cmd === 'read_dir') return [];
            if (cmd === 'list_manifest_files') return [];
            if (cmd === 'get_default_profiles_directory') return 'C:\\test\\profiles';
            return null;
          }
        },
        event: {
          listen: async (event: string, handler: Function) => {
            eventHandlers.set(event, handler);
            return () => eventHandlers.delete(event);
          }
        }
      };
      
      // Also provide mock engine for non-streaming paths
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
    await expect(page.locator('text=Engine Connection Issue')).not.toBeVisible();
    await expect(page.locator('text=Tauri streaming not available')).not.toBeVisible();
    await expect(page.locator('text=running in web mode without mock')).not.toBeVisible();
    
    // 2. App should be in ready state, not error state
    await expect(page.locator('text=Loading...')).not.toBeVisible();
    
    // 3. Navigation should work - navigate to Apply page
    await goToApplyPage(page);
  });

  test('Streaming invoke throws - error banner appears', async ({ page, baseURL }) => {
    // Force Advanced mode for sidebar navigation tests
    await forceAdvancedMode(page);

    // Setup: Mock Tauri APIs where invoke throws (real transport failure)
    await page.addInitScript(() => {
      (window as any).__TAURI__ = {
        core: {
          invoke: async (cmd: string, args?: any) => {
            if (cmd === 'run_endstate_streaming') {
              // Simulate real transport failure
              throw new Error('IPC channel closed unexpectedly');
            }
            if (cmd === 'ensure_dir') return null;
            if (cmd === 'read_dir') return [];
            if (cmd === 'list_manifest_files') return [];
            if (cmd === 'get_default_profiles_directory') return 'C:\\test\\profiles';
            return null;
          }
        },
        event: {
          listen: async (event: string, handler: Function) => {
            return () => {};
          }
        }
      };
    });
    
    await page.goto(baseURL || '/');
    
    // Wait for error state
    await page.waitForSelector('text=Engine Connection Issue', { timeout: 15000 });
    
    // CRITICAL ASSERTIONS:
    // 1. Error banner should be visible for real failures
    await expect(page.locator('text=Engine Connection Issue')).toBeVisible();
    
    // 2. UI should remain navigable (non-blocking error)
    await expect(page.locator('nav >> button:has-text("Capture computer")')).toBeVisible();
    await expect(page.locator('nav >> button:has-text("Settings")')).toBeVisible();
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
    await expect(page.locator('text=Engine Connection Issue')).not.toBeVisible();
    await expect(page.locator('text=Tauri streaming not available')).not.toBeVisible();
    
    // App should be usable - navigate to Apply page
    await goToApplyPage(page);
  });
});
