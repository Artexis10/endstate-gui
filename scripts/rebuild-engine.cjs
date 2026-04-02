// scripts/rebuild-engine.cjs
// Rebuilds the Go engine binary, copies it to sidecar locations, and logs
// the bundled version. Used by both predev (lenient) and prebuild (strict).
//
// Environment variables:
//   SKIP_ENGINE_BUILD=1    — skip the Go build step, just copy existing binary
//   STRICT_ENGINE_BUILD=1  — fail the build if Go compilation fails (set by prebuild)
//   ENDSTATE_ENGINE_DIR    — override the engine repo location (default: ../../endstate/go-engine)

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const strict = process.env.STRICT_ENGINE_BUILD === '1';

const ENGINE_DIR = process.env.ENDSTATE_ENGINE_DIR
  ? path.resolve(process.env.ENDSTATE_ENGINE_DIR)
  : path.resolve(__dirname, '../../endstate/go-engine');
const ENGINE_EXE = path.join(ENGINE_DIR, 'endstate.exe');
const SIDECAR_TRIPLE = path.join(ENGINE_DIR, 'endstate-x86_64-pc-windows-msvc.exe');
const DEBUG_EXE = path.resolve(__dirname, '../src-tauri/target/debug/endstate.exe');
const RELEASE_EXE = path.resolve(__dirname, '../src-tauri/target/release/endstate.exe');

// ---------------------------------------------------------------------------
// Step 1: Build the Go engine (unless skipped)
// ---------------------------------------------------------------------------
if (process.env.SKIP_ENGINE_BUILD === '1') {
  console.log('SKIP_ENGINE_BUILD=1 — skipping Go build.');
} else {
  // Read version files for ldflags embedding
  const engineRoot = path.resolve(ENGINE_DIR, '..');
  const ver = fs.readFileSync(path.join(engineRoot, 'VERSION'), 'utf8').trim();
  const schemaVer = fs.readFileSync(path.join(engineRoot, 'SCHEMA_VERSION'), 'utf8').trim();
  const ldflags = `-X github.com/Artexis10/endstate/go-engine/internal/config.version=${ver} -X github.com/Artexis10/endstate/go-engine/internal/config.schemaVersion=${schemaVer}`;

  // Staleness guard: warn or block if engine repo is behind origin/main
  try {
    execSync('git fetch origin main --quiet', {
      cwd: engineRoot,
      stdio: 'pipe',
      timeout: 15000,
    });
    const behind = execSync('git log HEAD..origin/main --oneline', {
      cwd: engineRoot,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    if (behind) {
      const count = behind.split('\n').length;
      const msg = `Local engine repo is ${count} commit(s) behind origin/main. Run: cd ${engineRoot} && git pull`;
      if (strict) {
        console.error(`ERROR: ${msg}`);
        process.exit(1);
      } else {
        console.warn(`WARNING: ${msg}`);
      }
    }
  } catch (err) {
    console.warn('WARNING: Could not check engine repo staleness (git fetch failed).');
  }

  try {
    console.log('Building Go engine...');
    const start = Date.now();
    execSync(`go build -ldflags "${ldflags}" -o endstate.exe ./cmd/endstate/`, {
      cwd: ENGINE_DIR,
      stdio: 'inherit',
    });
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const stats = fs.statSync(ENGINE_EXE);
    console.log(`Go engine built in ${elapsed}s (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
  } catch (err) {
    if (strict) {
      console.error('ERROR: Go engine build failed. Cannot proceed with production build.');
      process.exit(1);
    }
    // Lenient mode (dev): fall back to existing binary
    if (fs.existsSync(ENGINE_EXE)) {
      console.log('WARNING: Go build failed, using existing binary.');
    } else {
      console.log('WARNING: Go build failed and no existing binary found.');
      process.exit(0); // Don't fail predev — web-only dev still works
    }
  }
}

// ---------------------------------------------------------------------------
// Step 2: Copy to sidecar locations
// ---------------------------------------------------------------------------
if (!fs.existsSync(ENGINE_EXE)) {
  if (strict) {
    console.error(`ERROR: Engine binary not found at ${ENGINE_EXE}`);
    process.exit(1);
  }
  console.log('WARNING: No engine binary to copy.');
  process.exit(0);
}

// Sidecar triple (Tauri externalBin resolution in production installs)
fs.copyFileSync(ENGINE_EXE, SIDECAR_TRIPLE);
console.log('Copied to sidecar triple location.');

// Debug target (tauri dev sidecar resolution)
const debugDir = path.dirname(DEBUG_EXE);
if (!fs.existsSync(debugDir)) {
  fs.mkdirSync(debugDir, { recursive: true });
}
fs.copyFileSync(ENGINE_EXE, DEBUG_EXE);
console.log('Copied to debug sidecar location.');

// Release target (tauri build sidecar resolution)
const releaseDir = path.dirname(RELEASE_EXE);
if (!fs.existsSync(releaseDir)) {
  fs.mkdirSync(releaseDir, { recursive: true });
}
fs.copyFileSync(ENGINE_EXE, RELEASE_EXE);
console.log('Copied to release sidecar location.');

// ---------------------------------------------------------------------------
// Step 3: Extract and log engine version
// ---------------------------------------------------------------------------
let cliVersion = 'unknown';
let schemaVersion = 'unknown';
try {
  const raw = execSync(`"${ENGINE_EXE}" capabilities --json`, {
    encoding: 'utf8',
    timeout: 10000,
    windowsHide: true,
  }).trim();
  const caps = JSON.parse(raw);
  cliVersion = caps.cliVersion || 'unknown';
  schemaVersion = caps.schemaVersion || 'unknown';
} catch (err) {
  console.warn(`WARNING: Could not extract engine version: ${err.message}`);
}

console.log(`\n  Bundling engine v${cliVersion} (schema ${schemaVersion})\n`);

// Write build-time version record for GUI runtime display
const outDir = path.resolve(__dirname, '../src/generated');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}
fs.writeFileSync(
  path.join(outDir, 'engine-version.json'),
  JSON.stringify({ cliVersion, schemaVersion }, null, 2) + '\n'
);

console.log('Engine binary ready.');
