import { spawn } from 'child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
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
  // The fixture profile declares Windows package refs, so only a Windows engine
  // produces a populated actions[] for it. On Linux the same run legitimately
  // plans nothing and the payload assertions would fail on an empty list rather
  // than on any real defect. Gated by an explicit opt-in the Windows job sets,
  // not by sniffing the platform — and it announces the skip, because a quiet
  // skip is how an assertion stops running without anyone noticing.
  if (process.env.ENDSTATE_CONTRACT_PAYLOAD !== '1') {
    console.log('\n📋 Skipping apply payload + golden fixture assertions');
    console.log('   These require a Windows engine (the fixture profile uses Windows refs).');
    console.log('   They run in the engine-real-apply job; set ENDSTATE_CONTRACT_PAYLOAD=1 to run locally.');
    return;
  }

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

  // Keys whose presence depends on the run outcome, not the contract: these
  // are the `omitempty` fields on the engine's ApplyAction struct. A dev
  // machine reports `present` with a `version` where a clean CI runner reports
  // `to_install` without one, so an inventory that includes them can never
  // regenerate identically on both. Excluding them keeps regeneration
  // deterministic across hosts — a genuinely new engine field still lands in
  // actionKeys and diffs the committed fixture.
  const OPTIONAL_ACTION_KEYS = ['message', 'name', 'reason', 'rebootRequired', 'version'];

  // Regenerate the fixture the mock is asserted against. It is committed, so a
  // diff here means the engine's envelope changed and the mock must follow.
  const golden = {
    _generatedBy: 'tests/contract.test.js against the real pinned engine — do not hand-edit',
    cliVersion: envelope.cliVersion,
    envelopeKeys: Object.keys(envelope).sort(),
    dataKeys: Object.keys(data).sort(),
    actionKeys: [...new Set(data.actions.flatMap((action) => Object.keys(action)))]
      .filter((key) => !OPTIONAL_ACTION_KEYS.includes(key))
      .sort(),
    optionalActionKeys: OPTIONAL_ACTION_KEYS,
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

/**
 * Asserts a SUCCESSFUL restore-enabled apply, and regenerates the restore
 * golden fixture the E2E mock's restore-bearing scenario is held against.
 *
 * Distinct from testApplyPayloadAndRegenerateGolden: that one runs a --dry-run
 * and asserts only that restore modules are *planned*. This one runs a REAL
 * restore (--enable-restore, no --dry-run) so the copy actually executes, and
 * proves it lands only inside a throwaway temp workspace — never a real user
 * config location. Shape is asserted, not values, for the same reason as the
 * apply golden: a value-pinned fixture would be silenced rather than fixed.
 */
async function testRestorePayloadAndRegenerateGolden() {
  // Same opt-in gate as the apply payload test: the fixture resolves its
  // restore modules through the engine's module catalog, which the
  // engine-real-apply job checks out and points ENDSTATE_ROOT at. A quiet skip
  // is how an assertion stops running unnoticed, so announce it.
  if (process.env.ENDSTATE_CONTRACT_PAYLOAD !== '1') {
    console.log('\n📋 Skipping restore payload + golden fixture assertions');
    console.log('   These execute a real restore against temp targets (Windows engine + module catalog).');
    console.log('   They run in the engine-real-apply job; set ENDSTATE_CONTRACT_PAYLOAD=1 to run locally.');
    return;
  }

  console.log('\n📋 Testing: endstate apply --enable-restore (real restore to temp targets)');

  // Materialize the committed fixture into a throwaway temp workspace so every
  // restore target resolves inside it — never a real user config location.
  const fixtureDir = join(testDir, 'fixtures', 'restore-profile');
  const workspace = mkdtempSync(join(tmpdir(), 'endstate-restore-contract-'));
  try {
    const restoredDir = join(workspace, 'restored');
    // Copy the source configs so ./configs/<id>/ resolves relative to the temp manifest.
    cpSync(join(fixtureDir, 'configs'), join(workspace, 'configs'), { recursive: true });

    // Rewrite the target-dir token to the temp workspace. Forward slashes are
    // JSON-safe and accepted by the engine on Windows.
    const template = readFileSync(join(fixtureDir, 'manifest.jsonc'), 'utf8');
    const manifestText = template
      .split('__RESTORE_TARGET_DIR__')
      .join(restoredDir.replace(/\\/g, '/'));
    const manifestPath = join(workspace, 'manifest.jsonc');
    writeFileSync(manifestPath, manifestText);

    const result = await runEndstate('apply', ['--profile', manifestPath, '--enable-restore']);
    const envelope = parseEnvelope(result.stdout);

    if (!envelope.success) {
      throw new Error(
        'Expected a successful restore-enabled apply, got: ' + JSON.stringify(envelope.error)
      );
    }
    const data = envelope.data || {};

    // Same forbidden-field discipline as the apply payload test: these belong to
    // other commands and a consumer reading them fails silently.
    for (const forbidden of ['counts', 'items']) {
      if (forbidden in data) {
        throw new Error(
          `restore apply envelope unexpectedly contains data.${forbidden} — ` +
            `'counts' belongs to capture and 'items' to generations`
        );
      }
    }

    const modules = data.restoreModulesAvailable;
    if (!Array.isArray(modules) || modules.length === 0) {
      throw new Error('Expected restoreModulesAvailable for a profile carrying restore entries');
    }
    for (const mod of modules) {
      for (const field of ['id', 'displayName', 'entryCount']) {
        if (!(field in mod)) {
          throw new Error(`restoreModulesAvailable entry is missing '${field}'`);
        }
      }
      // Membership and count cannot disagree: the engine omits a module with no
      // resolved entries rather than reporting it empty.
      if (!(mod.entryCount > 0)) {
        throw new Error(`${mod.id} listed with non-positive entryCount ${mod.entryCount}`);
      }
    }

    // configResolutions are generation-aware config-payload rows. The legacy
    // copy-restore format this fixture uses does not carry them, so they are
    // absent here. Assert their SHAPE only if the engine ever starts emitting
    // them for this input, so a future contract shift is caught rather than
    // silently accepted.
    const configResolutions = data.configResolutions;
    const configResolutionsCarried =
      Array.isArray(configResolutions) && configResolutions.length > 0;
    if (configResolutionsCarried) {
      for (const row of configResolutions) {
        for (const field of ['captureId', 'moduleId', 'resolution', 'status']) {
          if (!(field in row)) {
            throw new Error(`configResolutions row is missing engine-authored field '${field}'`);
          }
        }
      }
    }

    // Prove the restore actually executed and wrote only inside the temp
    // workspace. optional:true means a missing source would be skipped, so a
    // present target file is positive evidence the copy ran.
    const expectedTargets = [
      join(restoredDir, 'vlc', 'vlcrc'),
      join(restoredDir, 'notepad-plus-plus', 'config.xml'),
      join(restoredDir, 'notepad-plus-plus', 'shortcuts.xml'),
    ];
    for (const target of expectedTargets) {
      if (!existsSync(target)) {
        throw new Error(`restore did not create the expected temp target ${target}`);
      }
    }

    console.log(`   ✓ restoreModulesAvailable scoped to ${modules.length} module(s) with entryCount`);
    console.log('   ✓ no items/counts on the restore envelope');
    console.log(`   ✓ restore executed to temp targets (${expectedTargets.length} files)`);
    console.log(`   ✓ configResolutions carried by this profile: ${configResolutionsCarried}`);

    // Same optional-key discipline as the apply golden: declare the engine's
    // omitempty keys rather than observing them, so regeneration is
    // host-independent. RestoreModuleRef (engine ApplyResult) marks none of
    // id/displayName/entryCount omitempty on the pinned engine, so the set is
    // empty — but the mechanism is replicated so a newly-omitempty field would
    // be excluded on purpose rather than by accident.
    const OPTIONAL_RESTORE_MODULE_KEYS = [];
    const golden = {
      _generatedBy: 'tests/contract.test.js against the real pinned engine — do not hand-edit',
      cliVersion: envelope.cliVersion,
      envelopeKeys: Object.keys(envelope).sort(),
      dataKeys: Object.keys(data).sort(),
      restoreModuleKeys: [...new Set(modules.flatMap((mod) => Object.keys(mod)))]
        .filter((key) => !OPTIONAL_RESTORE_MODULE_KEYS.includes(key))
        .sort(),
      optionalRestoreModuleKeys: OPTIONAL_RESTORE_MODULE_KEYS,
      summaryKeys: Object.keys(data.summary).sort(),
      configResolutionsCarried,
      forbiddenDataKeys: ['counts', 'items'],
    };
    const goldenPath = join(testDir, 'fixtures', 'restore-envelope.golden.json');
    const previous = existsSync(goldenPath) ? readFileSync(goldenPath, 'utf8') : '';
    const next = JSON.stringify(golden, null, 2) + '\n';
    if (previous !== next) {
      writeFileSync(goldenPath, next);
      console.log('   ⚠ restore golden fixture regenerated — commit the diff and update the mock');
    } else {
      console.log('   ✓ restore golden fixture unchanged');
    }
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}

/**
 * Asserts a REAL apply that mixes one resolvable app with one unresolvable
 * package ref reports the failure honestly.
 *
 * The half every other job skips: a per-item install failure is a PARTIAL
 * failure — the command ran, so envelope.success stays true while summary.failed
 * is non-zero. A consumer that reads envelope.success as "everything worked"
 * would render a broken run as clean. This asserts the mix at the envelope
 * level, in the same Node contract harness the mock is bound to.
 */
async function testMixedPartialFailure() {
  if (process.env.ENDSTATE_CONTRACT_PAYLOAD !== '1') {
    console.log('\n📋 Skipping mixed partial-failure payload assertions');
    console.log('   This runs a REAL apply (Windows engine); set ENDSTATE_CONTRACT_PAYLOAD=1 to run locally.');
    return;
  }

  console.log('\n📋 Testing: endstate apply (real) — one resolvable app + one unresolvable ref');

  const workspace = mkdtempSync(join(tmpdir(), 'endstate-partial-contract-'));
  try {
    // jq is small, fast, and resolvable; the bogus ref can never resolve. Two
    // apps keeps the run cheap. On this dev machine jq is already installed so
    // the run converges without mutation; on a clean CI runner an earlier step
    // installs it — either way jq converges and only the bogus ref fails.
    const manifest = {
      version: 1,
      name: 'partial-failure-case',
      apps: [
        { id: 'jq', refs: { windows: 'jqlang.jq' } },
        { id: 'bogus', refs: { windows: 'This.Package.Does.Not.Exist.Endstate.CI' } },
      ],
    };
    const manifestPath = join(workspace, 'manifest.jsonc');
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    // A REAL apply, not a dry run.
    const result = await runEndstate('apply', ['--profile', manifestPath]);
    const envelope = parseEnvelope(result.stdout);
    const data = envelope.data || {};

    if (envelope.success !== true) {
      throw new Error(
        `Expected envelope.success=true for a partial failure, got ${envelope.success}: ` +
          JSON.stringify(envelope.error)
      );
    }
    if (data.dryRun !== false) {
      throw new Error(`Expected a real apply (dryRun=false), got ${data.dryRun}`);
    }

    // The summary must show the mix honestly: at least one failure, and a
    // non-negative success count (jq converges to present/skipped on a machine
    // where it is already installed, or installed on a clean runner).
    if (!(data.summary.failed >= 1)) {
      throw new Error(`Expected summary.failed>=1, got ${data.summary.failed}`);
    }
    if (!(data.summary.success >= 0)) {
      throw new Error(`Expected summary.success>=0, got ${data.summary.success}`);
    }

    const failed = (data.actions || []).find((action) => action.id === 'bogus');
    if (!failed) {
      throw new Error('no action reported for the unresolvable package');
    }
    if (failed.status !== 'failed') {
      throw new Error(`expected the unresolvable package status 'failed', got '${failed.status}'`);
    }
    if (!failed.message) {
      throw new Error('a failed action must carry a message explaining why');
    }

    const converged = (data.actions || []).find((action) => action.id === 'jq');
    if (!converged) {
      throw new Error('no action reported for the resolvable package');
    }
    const CONVERGED_STATUSES = ['installed', 'present', 'already_installed'];
    if (!CONVERGED_STATUSES.includes(converged.status)) {
      throw new Error(
        `expected the resolvable package to converge (${CONVERGED_STATUSES.join('/')}), ` +
          `got '${converged.status}'`
      );
    }
    // to_install is dry-run-only; seeing it after a real apply means a plan was
    // reported as a result.
    if ((data.actions || []).some((action) => action.status === 'to_install')) {
      throw new Error('to_install survived a real apply');
    }

    console.log('   ✓ envelope.success=true despite a failed action (honest partial failure)');
    console.log(`   ✓ summary: success=${data.summary.success} failed=${data.summary.failed}`);
    console.log(`   ✓ unresolvable ref → ${failed.status}: ${failed.message}`);
    console.log(`   ✓ resolvable app converged → ${converged.status}`);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
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
    await testRestorePayloadAndRegenerateGolden();
    await testMixedPartialFailure();

    console.log('\n✅ All contract tests passed!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Contract test failed:', err.message);
    process.exit(1);
  }
}

runTests();
