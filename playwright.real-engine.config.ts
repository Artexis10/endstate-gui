import { defineConfig } from '@playwright/test';

/**
 * Real-engine Playwright config — the `gui-real-engine` CI lane.
 *
 * This config drives the REAL GUI against the REAL pinned engine through the
 * standalone dev HTTP bridge. Nothing here installs a mock: every invoke()/
 * listen() the app makes travels over the bridge (127.0.0.1:9876) to the
 * bundled `endstate.exe`, exactly as livewire does. It closes the one gap the
 * mocked `e2e` suite and the envelope-only `engine-real-apply` job cannot
 * cover — the GUI's own rendering of real engine output.
 *
 * Separation from the mocked suite is by testDir: the mocked `e2e` job runs
 * `playwright.config.ts` (testDir ./e2e, which does NOT recurse into
 * subdir configs) and this lane runs ONLY ./e2e/real-engine. The default
 * config's testDir is './e2e' but its specs are the flat *.spec.ts files;
 * this lane's specs live under ./e2e/real-engine and are picked up only here.
 * (Guarded by real-engine-config-separation.test at the repo level too.)
 *
 * The private launcher owns both listeners and reports readiness through IPC.
 * Each worker reads its protected session descriptor; traces stay disabled.
 */
export default defineConfig({
  testDir: './e2e/real-engine',
  timeout: 60_000,
  // Real engine spawns are serial at the Rust layer (one-run-at-a-time mutex),
  // so parallel workers would only contend on the bridge. Keep it single-file.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  // A real-engine flake is signal, not noise. One retry absorbs a transient
  // bridge/vite startup race without masking a genuine rendering regression.
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:1420',
    trace: 'off',
  },
  globalSetup: './e2e/real-engine/helpers/global-setup.ts',
});
