import { test as base, expect } from '@playwright/test';
import { installTauriMockOnContext, TauriMockOptions } from '../helpers/tauri-mock';

/**
 * Playwright fixture that creates a BrowserContext with __TAURI__ mock
 * installed BEFORE any pages are created. This ensures plugin-store and
 * other Tauri APIs are available during app module initialization.
 */

type TauriFixtures = {
  tauriMockOptions: TauriMockOptions;
};

export const test = base.extend<TauriFixtures>({
  tauriMockOptions: [{}, { option: true }],

  context: async ({ browser, tauriMockOptions }, use) => {
    // Create context manually
    const context = await browser.newContext();
    
    // Install Tauri mock BEFORE any pages are created
    await installTauriMockOnContext(context, tauriMockOptions);
    
    // Install engine mock at context level (same timing requirement)
    await context.addInitScript(() => {
      (window as any).__ENDSTATE_MOCK_ENGINE__ = {
        runEndstateStreaming: async (settings: any, command: string, args: string[], onEvent: Function) => {
          if (command === 'capabilities') {
            return {
              exitCode: 0,
              envelope: {
                success: true,
                data: {
                  version: '1.0.0',
                  drivers: ['winget', 'scoop'],
                  features: []
                }
              }
            };
          }
          return { exitCode: 0, envelope: { success: true, data: {} } };
        }
      };
    });
    
    await use(context);
    await context.close();
  },

  page: async ({ context }, use) => {
    const page = await context.newPage();
    await use(page);
    await page.close();
  },
});

export { expect };
