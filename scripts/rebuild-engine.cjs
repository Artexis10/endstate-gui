// scripts/rebuild-engine.js
// Rebuilds the Go engine binary and copies it to the sidecar locations.
// Called by npm predev to ensure the GUI always runs the latest engine.
//
// Environment variables:
//   SKIP_ENGINE_BUILD=1  — skip the Go build step, just copy existing binary
//   ENDSTATE_ENGINE_DIR  — override the engine repo location (default: ../../endstate/go-engine)

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ENGINE_DIR = process.env.ENDSTATE_ENGINE_DIR
  ? path.resolve(process.env.ENDSTATE_ENGINE_DIR)
  : path.resolve(__dirname, '../../endstate/go-engine');
const ENGINE_EXE = path.join(ENGINE_DIR, 'endstate.exe');
const SIDECAR_TRIPLE = path.join(ENGINE_DIR, 'endstate-x86_64-pc-windows-msvc.exe');
const DEBUG_EXE = path.resolve(__dirname, '../src-tauri/target/debug/endstate.exe');

// Step 1: Build (unless skipped)
if (process.env.SKIP_ENGINE_BUILD === '1') {
  console.log('SKIP_ENGINE_BUILD=1 — skipping Go build.');
} else {
  try {
    console.log('Building Go engine...');
    const start = Date.now();
    execSync('go build -o endstate.exe ./cmd/endstate/', {
      cwd: ENGINE_DIR,
      stdio: 'inherit',
    });
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const stats = fs.statSync(ENGINE_EXE);
    console.log(`Go engine built in ${elapsed}s (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
  } catch (err) {
    // Go not installed or build failed — fall back to existing binary
    if (fs.existsSync(ENGINE_EXE)) {
      console.log('WARNING: Go build failed, using existing binary.');
    } else {
      console.log('WARNING: Go build failed and no existing binary found.');
      process.exit(0); // Don't fail predev — web-only dev still works
    }
  }
}

// Step 2: Copy to sidecar triple location (Tauri sidecar resolution)
if (fs.existsSync(ENGINE_EXE)) {
  fs.copyFileSync(ENGINE_EXE, SIDECAR_TRIPLE);
  console.log('Copied to sidecar triple location.');
} else {
  console.log('WARNING: No engine binary to copy.');
  process.exit(0);
}

// Step 3: Copy to debug location (dev mode path resolution)
const debugDir = path.dirname(DEBUG_EXE);
if (!fs.existsSync(debugDir)) {
  fs.mkdirSync(debugDir, { recursive: true });
}
fs.copyFileSync(ENGINE_EXE, DEBUG_EXE);
console.log('Copied to debug sidecar location.');

console.log('Engine binary ready.');
