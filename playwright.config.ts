import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // The real-engine lane (e2e/real-engine/**) runs against a live engine via the
  // dev bridge under playwright.real-engine.config.ts. It installs no mock and
  // would fail in this mocked suite (no bridge, no engine), so keep it out.
  testIgnore: '**/real-engine/**',
  timeout: 30000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:1420',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npx vite dev --port 1420',
    url: 'http://127.0.0.1:1420',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      // Isolate test storage from Tauri dev storage
      VITE_STORAGE_NS: 'test',
      // Enable test-only hooks
      VITE_E2E: '1',
    },
  },
});
