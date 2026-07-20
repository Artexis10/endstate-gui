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
 * Two long-lived servers are managed by Playwright's multi-webServer support:
 *   1. endstate-dev-bridge — 127.0.0.1:9876 (engine HTTP/SSE; non-Tauri binary)
 *   2. vite                — 127.0.0.1:1420 (the frontend; VITE_BROWSER_BRIDGE=1)
 * The bridge resolves the engine from ENDSTATE_ENGINE_PATH / ENDSTATE_ROOT
 * (see src-tauri/engine-core/src/engine.rs::resolve_engine_path). If either is
 * missing the bridge cannot spawn the engine, the app's boot `capabilities`
 * call fails, and every spec fails loudly — there is no silent skip.
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
    trace: 'on-first-retry',
  },
  webServer: [
    {
      // Rebuilds only if stale (pre-built in CI), then runs the standalone
      // bridge. ENDSTATE_ENGINE_PATH / ENDSTATE_ROOT come from the environment
      // (the CI job / local shell). Absent → engine unresolved → specs fail.
      command: 'cargo run --quiet --manifest-path src-tauri/Cargo.toml -p endstate-dev-bridge',
      // The bridge has no dedicated health route; GET /events (SSE) answers 200
      // as soon as the listener is bound, which is all the readiness probe needs.
      url: 'http://127.0.0.1:9876/events',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'npx vite --port 1420 --strictPort',
      url: 'http://127.0.0.1:1420',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        // Route invoke()/listen() through the HTTP bridge to the real engine.
        VITE_BROWSER_BRIDGE: '1',
        // Isolate localStorage from tauri/web dev storage, matching the e2e job.
        VITE_STORAGE_NS: 'test',
      },
    },
  ],
});
