import { spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, '..');
const configuredEnginePath = process.env.ENDSTATE_ENGINE_PATH;
const engineCandidates = configuredEnginePath
  ? [configuredEnginePath]
  : [
      join(repoRoot, 'src-tauri', 'binaries', 'endstate-x86_64-pc-windows-msvc.exe'),
      join(repoRoot, '..', 'endstate', 'go-engine', 'endstate.exe'),
    ];
const ENDSTATE_ENGINE_PATH = engineCandidates.find((candidate) => existsSync(candidate));
const engineRequired = configuredEnginePath != null
  || (process.env.CI != null && process.env.CI !== 'false');

function checkEndstateAvailable() {
  if (!ENDSTATE_ENGINE_PATH) {
    const message = configuredEnginePath
      ? `Configured engine not found at ${configuredEnginePath}`
      : `Endstate engine not found. Checked: ${engineCandidates.join(', ')}`;
    if (engineRequired) {
      throw new Error(message);
    }
    console.log(`⚠️  ${message}`);
    console.log('   Run npm run build or set ENDSTATE_ENGINE_PATH; skipping outside CI.');
    return false;
  }
  return true;
}

function runEndstate(command, args = []) {
  return new Promise((resolve, reject) => {
    const fullArgs = [
      command,
      '--json',
      ...args,
    ];

    const proc = spawn(ENDSTATE_ENGINE_PATH, fullArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({ stdout, stderr, exitCode: code });
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

function parseEnvelope(stdout) {
  const trimmed = stdout.trim();
  if (!trimmed || !trimmed.startsWith('{')) {
    throw new Error('STDOUT is not valid JSON');
  }
  return JSON.parse(trimmed);
}

async function testCapabilities() {
  console.log('\n📋 Testing: endstate capabilities --json');
  
  const result = await runEndstate('capabilities');
  
  if (result.exitCode !== 0) {
    throw new Error(`capabilities exited with code ${result.exitCode}`);
  }

  const envelope = parseEnvelope(result.stdout);
  
  if (!envelope.schemaVersion) {
    throw new Error('Missing schemaVersion in envelope');
  }
  if (!envelope.cliVersion) {
    throw new Error('Missing cliVersion in envelope');
  }
  if (envelope.command !== 'capabilities') {
    throw new Error(`Expected command 'capabilities', got '${envelope.command}'`);
  }
  if (typeof envelope.success !== 'boolean') {
    throw new Error('Missing or invalid success field');
  }
  const applyFlags = envelope.data?.commands?.apply?.flags;
  if (!Array.isArray(applyFlags) || !applyFlags.includes('--restore-target')) {
    throw new Error('Pinned engine does not advertise apply --restore-target');
  }
  
  console.log('   ✓ Envelope structure valid');
  console.log('   ✓ Config generation target mapping supported');
  console.log(`   ✓ CLI version: ${envelope.cliVersion}`);
  console.log(`   ✓ Schema version: ${envelope.schemaVersion}`);
  console.log(`   ✓ Success: ${envelope.success}`);
}

async function testReport() {
  console.log('\n📋 Testing: endstate report --json');
  
  const result = await runEndstate('report');
  
  if (result.exitCode !== 0) {
    throw new Error(`report exited with code ${result.exitCode}`);
  }

  const envelope = parseEnvelope(result.stdout);
  
  if (!envelope.schemaVersion) {
    throw new Error('Missing schemaVersion in envelope');
  }
  if (envelope.command !== 'report') {
    throw new Error(`Expected command 'report', got '${envelope.command}'`);
  }
  if (typeof envelope.success !== 'boolean') {
    throw new Error('Missing or invalid success field');
  }
  
  console.log('   ✓ Envelope structure valid');
  console.log(`   ✓ Success: ${envelope.success}`);
  console.log(`   ✓ Has state: ${envelope.data?.hasState ?? false}`);
}

async function testVerifyMissing() {
  console.log('\n📋 Testing: endstate verify --profile Missing --json');
  
  const result = await runEndstate('verify', ['--profile', 'Missing']);
  
  const envelope = parseEnvelope(result.stdout);
  
  if (!envelope.schemaVersion) {
    throw new Error('Missing schemaVersion in envelope');
  }
  if (envelope.command !== 'verify') {
    throw new Error(`Expected command 'verify', got '${envelope.command}'`);
  }
  if (typeof envelope.success !== 'boolean') {
    throw new Error('Missing or invalid success field');
  }
  
  console.log('   ✓ Envelope structure valid');
  console.log(`   ✓ Success: ${envelope.success}`);
  
  if (!envelope.success && envelope.error) {
    console.log(`   ✓ Error code: ${envelope.error.code}`);
    console.log(`   ✓ Error message: ${envelope.error.message}`);
  }
}

async function testApplyMissing() {
  console.log('\n📋 Testing: endstate apply --profile Missing --dry-run --json');
  
  const result = await runEndstate('apply', ['--profile', 'Missing', '--dry-run']);
  
  const envelope = parseEnvelope(result.stdout);
  
  if (!envelope.schemaVersion) {
    throw new Error('Missing schemaVersion in envelope');
  }
  if (envelope.command !== 'apply') {
    throw new Error(`Expected command 'apply', got '${envelope.command}'`);
  }
  if (typeof envelope.success !== 'boolean') {
    throw new Error('Missing or invalid success field');
  }
  
  console.log('   ✓ Envelope structure valid');
  console.log(`   ✓ Success: ${envelope.success}`);
  
  if (!envelope.success && envelope.error) {
    console.log(`   ✓ Error code: ${envelope.error.code}`);
    console.log(`   ✓ Error message: ${envelope.error.message}`);
  }
}

/**
 * Asserts the payload of a SUCCESSFUL apply, and regenerates the golden fixture
 * the E2E mock is held against.
 *
 * `testApplyMissing` above covers the error path: it runs against a profile
 * named `Missing` and asserts only the envelope wrapper. That is why this suite
 * ran green while the GUI read `data.counts` and `data.items` — fields that
 * belong to `capture` and `generations` and have never existed on an apply
 * envelope. Reading an absent optional field disables the behavior depending on
 * it instead of erroring, so the GUI's final-state reconciliation was inert in
 * production while every test passed.
 *
 * Shape is asserted, not values: statuses depend on what the host already has
 * installed (a dev machine reports `present`, a clean runner `to_install`), and
 * a value-pinned fixture would end up silenced rather than fixed.
 */
async function testApplyPayloadAndRegenerateGolden() {
  const profile = join(testDir, 'fixtures', 'golden-profile', 'manifest.jsonc');
  console.log('\n📋 Testing: endstate apply --profile <golden-fixture> --dry-run --json');

  const result = await runEndstate('apply', ['--profile', profile, '--dry-run']);
  const envelope = parseEnvelope(result.stdout);

  if (!envelope.success) {
    throw new Error(
      'Expected a successful apply against the golden fixture profile, got: ' +
        JSON.stringify(envelope.error)
    );
  }

  const data = envelope.data || {};

  // Results live in actions[], aggregates in summary.
  for (const field of ['dryRun', 'summary', 'actions']) {
    if (!(field in data)) {
      throw new Error(`apply envelope data is missing '${field}'`);
    }
  }

  // These belong to other commands. A consumer reading them fails silently.
  for (const forbidden of ['counts', 'items']) {
    if (forbidden in data) {
      throw new Error(
        `apply envelope unexpectedly contains data.${forbidden} — ` +
          `'counts' belongs to capture and 'items' to generations`
      );
    }
  }

  if (data.dryRun !== true) {
    throw new Error(`Expected dryRun=true for a --dry-run apply, got ${data.dryRun}`);
  }
  if (data.summary.success !== 0) {
    throw new Error(`A dry run must install nothing; summary.success=${data.summary.success}`);
  }
  if (!Array.isArray(data.actions) || data.actions.length === 0) {
    throw new Error('Expected a non-empty actions[] for the fixture profile');
  }

  // restoreModulesAvailable is scoped to what the profile carries. The fixture
  // declares restore payload for two modules, and its sources carry no
  // fromModule — so this also covers the path-derivation tier that real
  // captured profiles depend on.
  const modules = data.restoreModulesAvailable;
  if (!Array.isArray(modules) || modules.length === 0) {
    throw new Error('Expected restoreModulesAvailable for a profile carrying restore entries');
  }
  for (const mod of modules) {
    for (const field of ['id', 'displayName']) {
      if (!(field in mod)) {
        throw new Error(`restoreModulesAvailable entry is missing '${field}'`);
      }
    }
    if (!('entryCount' in mod)) {
      // Ordering dependency, not a flake: entryCount ships with the engine-side
      // scoping change. Until that is released and ENGINE_VERSION is bumped to
      // pick it up, the pinned engine cannot emit this field. Fail loudly rather
      // than skipping — a conditional assertion here would silently stop
      // verifying the field forever once it did ship.
      throw new Error(
        `restoreModulesAvailable entry '${mod.id}' has no entryCount. ` +
          `The pinned engine (v${(readFileSync(join(repoRoot, 'ENGINE_VERSION'), 'utf8') || '').trim()}) ` +
          `predates the profile-scoping change. Bump ENGINE_VERSION to an engine ` +
          `release that includes it, then re-run.`
      );
    }
    if (!(mod.entryCount > 0)) {
      throw new Error(`${mod.id} listed with non-positive entryCount ${mod.entryCount}`);
    }
  }

  console.log('   ✓ summary + actions present; no items/counts');
  console.log('   ✓ dryRun honored (installed nothing)');
  console.log(`   ✓ restoreModulesAvailable scoped to ${modules.length} module(s) with entryCount`);

  // Regenerate the fixture the mock is asserted against. It is committed, so a
  // diff here means the engine's envelope changed and the mock must follow.
  const golden = {
    _generatedBy: 'tests/contract.test.js against the real pinned engine — do not hand-edit',
    cliVersion: envelope.cliVersion,
    envelopeKeys: Object.keys(envelope).sort(),
    dataKeys: Object.keys(data).sort(),
    actionKeys: Object.keys(data.actions[0]).sort(),
    restoreModuleKeys: Object.keys(modules[0]).sort(),
    summaryKeys: Object.keys(data.summary).sort(),
    forbiddenDataKeys: ['counts', 'items'],
  };
  const goldenPath = join(testDir, 'fixtures', 'apply-envelope.golden.json');
  const previous = existsSync(goldenPath) ? readFileSync(goldenPath, 'utf8') : '';
  const next = JSON.stringify(golden, null, 2) + '\n';
  if (previous !== next) {
    writeFileSync(goldenPath, next);
    console.log('   ⚠ golden fixture regenerated — commit the diff and update the mock');
  } else {
    console.log('   ✓ golden fixture unchanged');
  }
}

async function runTests() {
  console.log('🧪 Contract Integration Tests');
  console.log('================================');

  try {
    if (!checkEndstateAvailable()) {
      process.exit(0);
    }
    console.log('Engine:', ENDSTATE_ENGINE_PATH);
    await testCapabilities();
    await testReport();
    await testVerifyMissing();
    await testApplyMissing();
    await testApplyPayloadAndRegenerateGolden();
    
    console.log('\n✅ All contract tests passed!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Contract test failed:', err.message);
    process.exit(1);
  }
}

runTests();
