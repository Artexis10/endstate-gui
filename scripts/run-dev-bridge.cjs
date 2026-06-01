// scripts/run-dev-bridge.cjs
// Launch the livewire dev environment using the STANDALONE dev bridge instead
// of the in-process Tauri bridge.
//
// Runs two long-lived children and ties their lifetimes together:
//   1. Vite        — http://127.0.0.1:1420  (the frontend; VITE_BROWSER_BRIDGE=1)
//   2. dev-bridge  — http://127.0.0.1:9876  (engine HTTP/SSE; non-Tauri binary)
//
// The standalone bridge links none of the native GUI stack (tao/wry/webview2-com),
// which is where the intermittent 0xc0000374 heap corruption lived. The frontend
// (src/lib/http-bridge.ts) still targets :9876, so nothing else changes.
//
// ENDSTATE_ROOT: defaults to the sibling ../endstate repo (same source the Tauri
// resources copy from) so engine spawns find modules/payload. Override with the
// ENDSTATE_ROOT env var. Override the engine binary with ENDSTATE_ENGINE_PATH.

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const repoRoot = path.resolve(__dirname, '..');
const siblingEngine = path.resolve(repoRoot, '../endstate');

const env = { ...process.env };
if (!env.ENDSTATE_ROOT && fs.existsSync(siblingEngine)) {
  env.ENDSTATE_ROOT = siblingEngine;
}
// The bridge resolves its sidecar next to the compiled binary
// (src-tauri/target/debug/endstate.exe, placed by rebuild-engine.cjs). An
// explicit ENDSTATE_ENGINE_PATH override wins if set.

const children = [];
let shuttingDown = false;

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of children) {
    if (c && !c.killed) {
      try {
        c.kill('SIGTERM');
      } catch {
        /* already gone */
      }
    }
  }
  process.exit(code);
}

function launch(name, command, args, extraEnv) {
  const child = spawn(command, args, {
    cwd: repoRoot,
    env: { ...env, ...(extraEnv || {}) },
    stdio: 'inherit',
    shell: process.platform === 'win32', // npm/cargo on Windows need shell resolution
  });
  child.on('exit', (code, signal) => {
    if (!shuttingDown) {
      console.error(`[dev:bridge] ${name} exited (code=${code} signal=${signal}); shutting down.`);
      shutdown(code === null ? 1 : code);
    }
  });
  child.on('error', (err) => {
    console.error(`[dev:bridge] failed to start ${name}: ${err.message}`);
    shutdown(1);
  });
  children.push(child);
  return child;
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log('[dev:bridge] starting Vite (1420) + standalone dev bridge (9876)…');
if (env.ENDSTATE_ROOT) {
  console.log(`[dev:bridge] ENDSTATE_ROOT=${env.ENDSTATE_ROOT}`);
}

// Vite (frontend). VITE_* flags come from the npm script's cross-env.
launch('vite', 'npm', ['run', 'dev']);

// Standalone bridge. Build+run via cargo; first run compiles (~quick, already built).
launch('dev-bridge', 'cargo', [
  'run',
  '--quiet',
  '--manifest-path',
  'src-tauri/Cargo.toml',
  '-p',
  'endstate-dev-bridge',
]);
