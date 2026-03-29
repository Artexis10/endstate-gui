// scripts/check-engine-version.cjs
// Runs before production builds to log and record the bundled engine version.
// Extracts cliVersion from the engine binary's capabilities output and writes
// it to src/generated/engine-version.json so the GUI can display it at runtime.
//
// Environment variables:
//   ENDSTATE_ENGINE_DIR — override the engine repo location (default: ../../endstate/go-engine)

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ENGINE_DIR = process.env.ENDSTATE_ENGINE_DIR
  ? path.resolve(process.env.ENDSTATE_ENGINE_DIR)
  : path.resolve(__dirname, '../../endstate/go-engine');
const SIDECAR_TRIPLE = path.join(ENGINE_DIR, 'endstate-x86_64-pc-windows-msvc.exe');
const ENGINE_EXE = path.join(ENGINE_DIR, 'endstate.exe');

// Find the engine binary — prefer the triple-suffixed sidecar, fall back to plain exe
const exe = fs.existsSync(SIDECAR_TRIPLE) ? SIDECAR_TRIPLE : ENGINE_EXE;

if (!fs.existsSync(exe)) {
  console.error(`ERROR: Engine binary not found at ${ENGINE_DIR}`);
  console.error('Run "npm run dev" first to build the engine, or set ENDSTATE_ENGINE_DIR.');
  process.exit(1);
}

// Extract version from capabilities --json
let cliVersion = 'unknown';
let schemaVersion = 'unknown';
try {
  const raw = execSync(`"${exe}" capabilities --json`, {
    encoding: 'utf8',
    timeout: 10000,
    windowsHide: true,
  }).trim();
  const caps = JSON.parse(raw);
  cliVersion = caps.cliVersion || caps.data?.cliVersion || 'unknown';
  schemaVersion = caps.schemaVersion || caps.data?.schemaVersion || 'unknown';
} catch (err) {
  console.warn(`WARNING: Could not extract engine version: ${err.message}`);
  // Try VERSION file as fallback
  const versionFile = path.resolve(ENGINE_DIR, '../../VERSION');
  if (fs.existsSync(versionFile)) {
    cliVersion = fs.readFileSync(versionFile, 'utf8').trim();
    console.warn(`  Falling back to VERSION file: ${cliVersion}`);
  }
}

// Log clearly during build
console.log(`\n  Bundling engine v${cliVersion} (schema ${schemaVersion})\n`);

// Write to a generated file that Vite can import at build time
const outDir = path.resolve(__dirname, '../src/generated');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}
const outFile = path.join(outDir, 'engine-version.json');
fs.writeFileSync(outFile, JSON.stringify({ cliVersion, schemaVersion }, null, 2) + '\n');
