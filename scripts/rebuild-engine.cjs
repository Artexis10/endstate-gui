// scripts/rebuild-engine.cjs
// Rebuilds the Go engine binary, copies it to sidecar locations, and logs
// the bundled version. Used by both predev (lenient) and prebuild (strict).
//
// Environment variables:
//   SKIP_ENGINE_BUILD=1    — skip the Go build step, just copy existing binary
//   STRICT_ENGINE_BUILD=1  — fail the build if Go compilation fails (set by prebuild)
//   ENDSTATE_ENGINE_DIR    — override the engine repo location (default: ../../endstate/go-engine)
//
// CI download mode: when CI pre-places the binary at SIDECAR_TRIPLE before this
// script runs, the Go build is skipped automatically — no env var needed.

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const strict = process.env.STRICT_ENGINE_BUILD === '1';

const ENGINE_DIR = process.env.ENDSTATE_ENGINE_DIR
  ? path.resolve(process.env.ENDSTATE_ENGINE_DIR)
  : path.resolve(__dirname, '../../endstate/go-engine');

// Canonical sidecar location (src-tauri/binaries/) — Tauri externalBin resolution.
// In CI this is pre-placed by the "Acquire engine binary" workflow step.
// For local dev it is written by Step 2 below after a source build.
const SIDECAR_TRIPLE = path.resolve(__dirname, '../src-tauri/binaries/endstate-x86_64-pc-windows-msvc.exe');
const ENGINE_EXE = path.join(ENGINE_DIR, 'endstate.exe');
const DEBUG_EXE = path.resolve(__dirname, '../src-tauri/target/debug/endstate.exe');
const RELEASE_EXE = path.resolve(__dirname, '../src-tauri/target/release/endstate.exe');

// ---------------------------------------------------------------------------
// Step 1: Build the Go engine (unless skipped or pre-placed binary detected)
// ---------------------------------------------------------------------------
const prePlaced = fs.existsSync(SIDECAR_TRIPLE);

if (prePlaced) {
  console.log('Pre-placed engine binary detected at sidecar location — skipping Go build.');
} else if (process.env.SKIP_ENGINE_BUILD === '1') {
  console.log('SKIP_ENGINE_BUILD=1 — skipping Go build.');
} else {
  // Read version files for ldflags embedding
  const engineRoot = path.resolve(ENGINE_DIR, '..');
  // Version comes from the release-please manifest — the single source of
  // truth the engine itself uses at runtime (go-engine internal/config/
  // version.go ReadVersion). The legacy VERSION file is NOT bumped by
  // release-please (frozen at an old value), and released binaries derive
  // their version from the git tag (engine release.yml). Reading VERSION here
  // embeds a stale version into local source builds only. See Artexis10/endstate#54.
  let ver = '0.0.0-dev';
  try {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(engineRoot, '.release-please-manifest.json'), 'utf8'),
    );
    if (typeof manifest['.'] === 'string' && manifest['.'].trim()) {
      ver = manifest['.'].trim();
    }
  } catch {
    // Manifest missing/malformed (e.g. a fork without release-please) — keep
    // the 0.0.0-dev fallback, matching version.go's fallbackVersion.
  }
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
// SOURCE_EXE: the binary to copy FROM.
// If the sidecar triple was pre-placed (CI download mode), use it directly.
// Otherwise use the freshly-built ENGINE_EXE.
const SOURCE_EXE = prePlaced ? SIDECAR_TRIPLE : ENGINE_EXE;

if (!fs.existsSync(SOURCE_EXE)) {
  if (strict) {
    console.error(`ERROR: Engine binary not found at ${SOURCE_EXE}`);
    process.exit(1);
  }
  console.log('WARNING: No engine binary to copy.');
  process.exit(0);
}

// Sidecar triple (Tauri externalBin resolution in production installs).
// Ensure binaries/ directory exists for local dev (CI has it via .gitkeep).
const sidecarDir = path.dirname(SIDECAR_TRIPLE);
if (!fs.existsSync(sidecarDir)) {
  fs.mkdirSync(sidecarDir, { recursive: true });
}
if (SOURCE_EXE !== SIDECAR_TRIPLE) {
  fs.copyFileSync(SOURCE_EXE, SIDECAR_TRIPLE);
  console.log('Copied to sidecar triple location.');
} else {
  console.log('Sidecar triple already in place (pre-placed by CI).');
}

// Debug target (tauri dev sidecar resolution)
const debugDir = path.dirname(DEBUG_EXE);
if (!fs.existsSync(debugDir)) {
  fs.mkdirSync(debugDir, { recursive: true });
}
fs.copyFileSync(SOURCE_EXE, DEBUG_EXE);
console.log('Copied to debug sidecar location.');

// Release target (tauri build sidecar resolution)
const releaseDir = path.dirname(RELEASE_EXE);
if (!fs.existsSync(releaseDir)) {
  fs.mkdirSync(releaseDir, { recursive: true });
}
fs.copyFileSync(SOURCE_EXE, RELEASE_EXE);
console.log('Copied to release sidecar location.');

// ---------------------------------------------------------------------------
// Step 3: Extract and log engine version
// ---------------------------------------------------------------------------
let cliVersion = 'unknown';
let schemaVersion = 'unknown';
try {
  const raw = execSync(`"${SIDECAR_TRIPLE}" capabilities --json`, {
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

// ---------------------------------------------------------------------------
// Drift heads-up (non-blocking): warn when the bundled binary doesn't match the
// ENGINE_VERSION pin. The binary is gitignored and refreshed by CI from the
// pinned engine release; locally it goes stale when ENGINE_VERSION is bumped
// but a pre-placed binary persists (Step 1's pre-placed branch then skips the
// rebuild). We WARN rather than fail: a hard gate would block intentional local
// custom builds, and the released cliVersion is the reliable signal here
// (released binaries derive it from the git tag, unlike local source builds —
// Artexis10/endstate#54), so a mismatch is worth surfacing but not fatal.
// ---------------------------------------------------------------------------
try {
  const pinned = fs
    .readFileSync(path.resolve(__dirname, '../ENGINE_VERSION'), 'utf8')
    .trim();
  if (pinned && cliVersion !== 'unknown' && cliVersion !== pinned) {
    console.warn(
      'WARNING: bundled engine is out of sync with the pin (non-blocking).\n' +
        `  ENGINE_VERSION pins: v${pinned}\n` +
        `  bundled binary:      v${cliVersion}\n` +
        '  Refresh it:          npm run engine:refresh\n',
    );
  }
} catch {
  // No ENGINE_VERSION file — nothing to compare against.
}

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
