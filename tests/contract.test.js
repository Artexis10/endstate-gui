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

function runEndstate(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const fullArgs = options.jsonAfterArgs
      ? [command, ...args, '--json']
      : [command, '--json', ...args];

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

/**
 * Extracts a capture bundle (.zip) into destDir. A captured manifest carries
 * config-restore blocks whose relative payloadRoots (configs/…) must resolve on
 * disk, so the whole bundle — manifest + configs tree — has to be materialized
 * together before apply will even validate a dry run.
 *
 * Node 20 ships no zip reader, and the GNU tar on the CI bash shell mis-parses a
 * `C:` path as a remote host. Windows PowerShell's System.IO.Compression is the
 * one extractor guaranteed present on the windows-latest runner that handles the
 * path natively — and this assertion only runs under ENDSTATE_CONTRACT_PAYLOAD=1,
 * which is set solely by the Windows engine-real-apply job.
 */
function extractBundle(bundlePath, destDir) {
  return new Promise((resolve, reject) => {
    const script =
      'Add-Type -AssemblyName System.IO.Compression.FileSystem; ' +
      `[System.IO.Compression.ZipFile]::ExtractToDirectory('${bundlePath}', '${destDir}')`;
    const proc = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stderr = '';
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`bundle extraction failed (exit ${code}): ${stderr.trim()}`));
      } else {
        resolve();
      }
    });
    proc.on('error', reject);
  });
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
  if (envelope.data?.features?.profileInspection !== true) {
    throw new Error('Pinned engine does not advertise features.profileInspection=true');
  }
  
  console.log('   ✓ Envelope structure valid');
  console.log('   ✓ Config generation target mapping supported');
  console.log('   ✓ Profile inspection supported');

  // The pinned engine must report the version we pinned. Nothing else asserts
  // this: verify-engine-pin.yml proves only that the release exists and carries
  // its assets, and the golden fixtures pin shape rather than values by design.
  // The gap is not theoretical — the engine once reported cliVersion 2.0.0
  // against a 2.5.0 pin because its VERSION file was never bumped on release
  // (Artexis10/endstate#54), which silently ships a GUI verified against a
  // binary it does not run. Enforced in CI, where engine-real-apply checks the
  // engine out at ENGINE_REF; a dev machine legitimately runs a locally built
  // engine ahead of the pin, so there it warns rather than blocking the loop.
  const pinnedVersion = readFileSync(join(repoRoot, 'ENGINE_VERSION'), 'utf8').trim();
  const enforceVersionPin = process.env.CI != null && process.env.CI !== 'false';
  if (envelope.cliVersion !== pinnedVersion) {
    const drift =
      `Engine reports cliVersion ${envelope.cliVersion} but ENGINE_VERSION pins ${pinnedVersion}. `
      + 'Either the engine\'s VERSION file was not bumped for its release, or this run is not '
      + 'using the pinned binary.';
    if (enforceVersionPin) {
      throw new Error(drift);
    }
    console.log(`   ⚠ ${drift}`);
  } else {
    console.log(`   ✓ CLI version ${envelope.cliVersion} matches the ENGINE_VERSION pin`);
  }
  console.log(`   ✓ Schema version: ${envelope.schemaVersion}`);
  console.log(`   ✓ Success: ${envelope.success}`);
}

function assertExactKeys(value, expectedKeys, subject) {
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${subject} keys differ: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertRowsSorted(rows, subject) {
  const actual = rows.map((row) => row.id);
  const expected = [...rows]
    .sort((left, right) => {
      const label = left.displayName.localeCompare(right.displayName, undefined, { sensitivity: 'accent' });
      return label || left.id.localeCompare(right.id);
    })
    .map((row) => row.id);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${subject} is not deterministically ordered: ${JSON.stringify(actual)}`);
  }
}

async function testProfileInspectionAndRegenerateGolden() {
  const profile = join(testDir, 'fixtures', 'profile-inspect-profile', 'manifest.jsonc');
  console.log('\n📋 Testing: endstate profile inspect <profile-inspect-fixture> --json');

  const result = await runEndstate('profile', ['inspect', profile], { jsonAfterArgs: true });
  if (result.exitCode !== 0) {
    throw new Error(`profile inspect exited with code ${result.exitCode}: ${result.stderr.trim()}`);
  }

  const envelope = parseEnvelope(result.stdout);
  if (!/^1\.\d+$/.test(envelope.schemaVersion)) {
    throw new Error(`Expected schema 1.x, got ${JSON.stringify(envelope.schemaVersion)}`);
  }
  if (envelope.command !== 'profile' || envelope.success !== true || envelope.error !== null) {
    throw new Error(`Expected successful profile envelope, got ${JSON.stringify(envelope)}`);
  }
  assertExactKeys(
    envelope,
    ['schemaVersion', 'cliVersion', 'command', 'runId', 'timestampUtc', 'success', 'data', 'error'],
    'profile inspect envelope'
  );

  const data = envelope.data;
  assertExactKeys(data, ['profile', 'apps', 'settingsApps', 'warnings', 'summary'], 'profile inspect data');
  assertExactKeys(data.profile, ['name', 'capturedAt', 'manifestVersion', 'manifestPath'], 'profile inspect profile');
  assertExactKeys(
    data.summary,
    ['appCount', 'settingsRowCount', 'verifiedSettingsAppCount', 'unidentifiedSettingsRowCount'],
    'profile inspect summary'
  );

  if (data.profile.name !== null || data.profile.capturedAt !== null || data.profile.manifestVersion !== 2) {
    throw new Error(`Fixture must preserve nullable profile metadata, got ${JSON.stringify(data.profile)}`);
  }
  if (data.profile.manifestPath !== profile) {
    throw new Error(`profile inspect returned the wrong manifest path: ${JSON.stringify(data.profile.manifestPath)}`);
  }
  if (!Array.isArray(data.apps) || data.apps.length < 2) {
    throw new Error('Expected at least two Apps rows from the profile inspection fixture');
  }
  if (!Array.isArray(data.settingsApps) || data.settingsApps.length < 2 || !Array.isArray(data.warnings)) {
    throw new Error('Expected non-empty settingsApps and non-null warnings arrays from profile inspect');
  }

  for (const app of data.apps) {
    assertExactKeys(app, ['id', 'manifestAppId', 'displayName', 'packageRefs', 'hasSettings'], 'profile inspect app');
    if (!Array.isArray(app.packageRefs)) {
      throw new Error(`App ${app.id} has a non-array packageRefs field`);
    }
  }
  assertRowsSorted(data.apps, 'Apps rows');

  const statusCounts = new Map();
  const settingsRowIds = new Set();
  const verifiedOwnerIds = new Set();
  for (const row of data.settingsApps) {
    assertExactKeys(
      row,
      ['id', 'displayName', 'associationStatus', 'ownerId', 'appId', 'appIncluded', 'packageRefs', 'moduleIds', 'candidateAppIds', 'capturedEntryCount'],
      'profile inspect settings row'
    );
    for (const field of ['packageRefs', 'moduleIds', 'candidateAppIds']) {
      if (!Array.isArray(row[field])) {
        throw new Error(`Settings row ${row.id} has a non-array ${field} field`);
      }
    }
    if (settingsRowIds.has(row.id)) {
      throw new Error(`Duplicate profile inspect settings row id ${JSON.stringify(row.id)}`);
    }
    settingsRowIds.add(row.id);
    statusCounts.set(row.associationStatus, (statusCounts.get(row.associationStatus) || 0) + 1);
    const isIncluded = row.associationStatus === 'included';
    const isAbsent = row.associationStatus === 'not_in_profile';
    const isAmbiguous = row.associationStatus === 'ambiguous';
    const isUnresolved = row.associationStatus === 'unresolved';
    if (!isIncluded && !isAbsent && !isAmbiguous && !isUnresolved) {
      throw new Error(`Unexpected associationStatus ${JSON.stringify(row.associationStatus)}`);
    }
    if ((isIncluded || isAbsent) !== (typeof row.ownerId === 'string')) {
      throw new Error(`ownerId/status matrix mismatch for ${row.id}`);
    }
    if (isIncluded || isAbsent) {
      if (verifiedOwnerIds.has(row.ownerId)) {
        throw new Error(`Duplicate verified ownerId ${JSON.stringify(row.ownerId)}`);
      }
      verifiedOwnerIds.add(row.ownerId);
    }
    if (isIncluded !== (typeof row.appId === 'string') || isIncluded !== row.appIncluded) {
      throw new Error(`appId/appIncluded/status matrix mismatch for ${row.id}`);
    }
    if (isIncluded && (row.candidateAppIds.length !== 1 || row.candidateAppIds[0] !== row.appId)) {
      throw new Error(`included candidate matrix mismatch for ${row.id}`);
    }
    if ((!isIncluded && !isAmbiguous) && row.candidateAppIds.length !== 0) {
      throw new Error(`non-candidate row ${row.id} has candidate IDs`);
    }
  }
  assertRowsSorted(data.settingsApps, 'Settings rows');

  if (statusCounts.get('included') !== 1 || statusCounts.get('not_in_profile') !== 1) {
    throw new Error(`Fixture must yield one included and one not_in_profile row, got ${JSON.stringify(Object.fromEntries(statusCounts))}`);
  }
  if (data.summary.appCount !== data.apps.length || data.summary.settingsRowCount !== data.settingsApps.length) {
    throw new Error(`Summary inventory counts differ from finalized arrays: ${JSON.stringify(data.summary)}`);
  }
  const verified = verifiedOwnerIds.size;
  const unidentified = data.settingsApps.filter(
    (row) => row.associationStatus === 'ambiguous' || row.associationStatus === 'unresolved'
  ).length;
  if (data.summary.verifiedSettingsAppCount !== verified || data.summary.unidentifiedSettingsRowCount !== unidentified) {
    throw new Error(`Summary association counts differ from finalized rows: ${JSON.stringify(data.summary)}`);
  }
  const included = data.settingsApps.find((row) => row.associationStatus === 'included');
  const absent = data.settingsApps.find((row) => row.associationStatus === 'not_in_profile');
  if (
    included?.appId !== 'app:included-app:1'
    || included.ownerId !== included.appId
    || JSON.stringify(included.packageRefs) !== JSON.stringify(['Vendor.Included'])
    || JSON.stringify(included.moduleIds) !== JSON.stringify(['apps.included'])
  ) {
    throw new Error(`Included settings fixture semantics drifted: ${JSON.stringify(included)}`);
  }
  if (
    absent?.ownerId !== 'package:vendor.absent'
    || absent.appId !== null
    || absent.appIncluded !== false
    || JSON.stringify(absent.packageRefs) !== JSON.stringify(['Vendor.Absent'])
    || JSON.stringify(absent.moduleIds) !== JSON.stringify(['apps.absent'])
  ) {
    throw new Error(`Absent-owner settings fixture semantics drifted: ${JSON.stringify(absent)}`);
  }

  // The engine returns the input's absolute path verbatim. It is asserted above,
  // but normalized only in the committed golden because a CI checkout path is not
  // part of the inspection contract's semantic inventory.
  const goldenData = JSON.parse(JSON.stringify(data));
  goldenData.profile.manifestPath = '<fixture-manifest-path>';
  const golden = {
    _generatedBy: 'tests/contract.test.js against Endstate v2.30.0 — do not hand-edit',
    schemaVersion: envelope.schemaVersion,
    command: envelope.command,
    success: envelope.success,
    error: envelope.error,
    data: goldenData,
  };
  const goldenPath = join(testDir, 'fixtures', 'profile-inspect-envelope.golden.json');
  const previous = existsSync(goldenPath) ? readFileSync(goldenPath, 'utf8') : '';
  const next = JSON.stringify(golden, null, 2) + '\n';
  if (previous !== next) {
    writeFileSync(goldenPath, next);
    console.log('   ⚠ profile inspection golden regenerated — commit the diff');
  } else {
    console.log('   ✓ profile inspection golden unchanged');
  }
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
  const OPTIONAL_ACTION_KEYS = ['message', 'name', 'reason', 'rebootRequired', 'source', 'version'];

  // Regenerate the fixture the mock is asserted against. It is committed, so a
  // diff here means the engine's envelope changed and the mock must follow.
  //
  // cliVersion is deliberately absent. It is a value, not a shape, and it
  // changes on every engine bump — so recording it made this guard fail on
  // every drift-bot PR for a reason that was never a contract change, training
  // reviewers to wave through the one check built to be believed. Its presence
  // is still covered (it appears in envelopeKeys) and its correctness is
  // asserted against the ENGINE_VERSION pin in testCapabilities(). Do not add
  // it back: any field that changes for reasons unrelated to the contract
  // belongs outside the diffed payload.
  const golden = {
    _generatedBy: 'tests/contract.test.js against the real pinned engine — do not hand-edit',
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
    // cliVersion is deliberately absent here too — see the apply golden above.
    const golden = {
      _generatedBy: 'tests/contract.test.js against the real pinned engine — do not hand-edit',
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

/**
 * Asserts a REAL capture → re-import → dry-run → apply(--only) round trip against
 * the pinned engine. Every other job hand-writes the manifest it applies, so
 * nothing else proved that a manifest the engine itself CAPTURED re-imports and
 * applies — the exact gap the July regression wave slipped through. This closes
 * two of its holes:
 *   1. capture → apply with the real engine: the manifest under apply is the one
 *      capture emitted, not one authored by the test.
 *   2. --only scoping: the flag must filter BEFORE planning, so an unselected
 *      captured app is never planned and therefore never installed.
 *
 * Restore-on-disk is deliberately NOT re-proven here — testRestorePayloadAndRegenerateGolden
 * already lands real files from a captured-shape profile into a temp workspace.
 * This apply runs WITHOUT --enable-restore, so the captured config payload is
 * validated but never written; the loop under test is the package path.
 *
 * Membership-in-a-set is asserted, not pinned values: statuses depend on host
 * state (jq is installed by an earlier engine-real-apply step, so it converges to
 * present), and a value-pinned assertion would silence a regression rather than
 * catch it — the same discipline as the golden payload tests above.
 */
async function testCaptureApplyRoundtrip() {
  if (process.env.ENDSTATE_CONTRACT_PAYLOAD !== '1') {
    console.log('\n📋 Skipping capture → apply round-trip assertions');
    console.log('   These run a REAL winget capture + apply (Windows engine).');
    console.log('   They run in the engine-real-apply job; set ENDSTATE_CONTRACT_PAYLOAD=1 to run locally.');
    return;
  }

  console.log('\n📋 Testing: capture → re-import → dry-run → apply(--only) round trip');

  // jq is the round-trip anchor: small, fast, already installed by an earlier
  // engine-real-apply step, and captured from the live winget inventory rather
  // than hand-declared. Its winget ref is stable; its manifest id is engine-
  // derived (jqlang.jq → jqlang-jq), so it is resolved by ref, never guessed.
  const JQ_WINGET_REF = 'jqlang.jq';
  // A --dry-run reflects host presence: an installed app plans `present`, an
  // absent one plans `to_install`. Both are honest, so the row is asserted
  // against the set rather than pinned.
  const PRESENCE_STATUSES = ['present', 'to_install', 'skipped', 'installed', 'already_installed'];
  // A REAL apply must converge, never leave a plan-only `to_install` behind.
  const CONVERGED_STATUSES = ['installed', 'present', 'already_installed', 'skipped'];
  const norm = (p) => p.replace(/\\/g, '/').toLowerCase();

  const workspace = mkdtempSync(join(tmpdir(), 'endstate-roundtrip-contract-'));
  try {
    // 1) REAL capture, scoped to the winget driver — the narrowest scope v2.25.0
    //    offers (capture has no per-app filter). --out lands the artifact inside
    //    the throwaway workspace; the engine rewrites the extension to .zip when
    //    it bundles config payload, so the real path comes from data.outputPath.
    const requestedOut = join(workspace, 'capture.jsonc');
    const capture = parseEnvelope(
      (await runEndstate('capture', ['--driver', 'winget', '--discover', '--out', requestedOut])).stdout
    );

    if (!capture.success) {
      throw new Error('Expected a successful capture, got: ' + JSON.stringify(capture.error));
    }
    if (capture.command !== 'capture') {
      throw new Error(`Expected command 'capture', got '${capture.command}'`);
    }

    // 2) Capture envelope: a real bundle artifact landed inside the workspace,
    //    and the counts + appsIncluded reflect a non-empty scope carrying jq.
    const cdata = capture.data || {};
    const bundlePath = cdata.outputPath;
    if (!bundlePath || !existsSync(bundlePath)) {
      throw new Error(`capture did not write a bundle artifact (outputPath=${bundlePath})`);
    }
    if (!norm(bundlePath).startsWith(norm(workspace))) {
      throw new Error(`capture wrote outside the temp workspace: ${bundlePath}`);
    }
    if (!(cdata.counts && cdata.counts.included >= 1)) {
      throw new Error(`Expected counts.included>=1, got ${JSON.stringify(cdata.counts)}`);
    }
    if (cdata.counts.included > cdata.counts.totalFound) {
      throw new Error(
        `counts inconsistent: included ${cdata.counts.included} > totalFound ${cdata.counts.totalFound}`
      );
    }
    const includedApps = cdata.appsIncluded;
    if (!Array.isArray(includedApps) || includedApps.length === 0) {
      throw new Error('Expected a non-empty appsIncluded from a --discover capture');
    }
    if (!includedApps.some((app) => app.id === JQ_WINGET_REF)) {
      throw new Error(`capture did not include ${JQ_WINGET_REF} (is it installed on the host?)`);
    }

    console.log(
      `   ✓ capture: ${cdata.counts.included}/${cdata.counts.totalFound} apps, bundle inside workspace`
    );

    // Materialize the whole bundle so the manifest's relative config payloadRoots
    // resolve — apply validates them even for a dry run. Extraction stays inside
    // the workspace.
    const capturedDir = join(workspace, 'captured');
    await extractBundle(bundlePath, capturedDir);
    const manifestPath = join(capturedDir, 'manifest.jsonc');
    if (!existsSync(manifestPath)) {
      throw new Error('capture bundle did not contain manifest.jsonc');
    }

    // The manifest the engine itself wrote — parsed only to resolve the engine-
    // derived jq id and a second real app id to prove --only excludes it. The
    // apps applied below are the engine's, not the test's.
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const manifestApps = manifest.apps || [];
    if (manifestApps.length < 2) {
      throw new Error(
        `Expected the captured manifest to carry jq plus at least one other app, got ${manifestApps.length}`
      );
    }
    const jqApp = manifestApps.find((app) => app.refs && app.refs.windows === JQ_WINGET_REF);
    if (!jqApp) {
      throw new Error(`captured manifest has no app with a ${JQ_WINGET_REF} windows ref`);
    }
    const jqId = jqApp.id;
    const otherId = manifestApps.find((app) => app.id !== jqId).id;

    // 3) Re-import: dry-run the FULL captured manifest. A dry run mutates nothing
    //    (summary.success===0), and the jq row reflects the host. counts/items
    //    belong to capture/generations — an apply consumer reading them fails
    //    silently, so their absence is asserted here too.
    const dry = parseEnvelope(
      (await runEndstate('apply', ['--manifest', manifestPath, '--dry-run'])).stdout
    );
    const ddata = dry.data || {};
    if (!dry.success) {
      throw new Error(
        'Expected a successful dry-run of the captured manifest, got: ' + JSON.stringify(dry.error)
      );
    }
    if (ddata.dryRun !== true) {
      throw new Error(`Expected dryRun=true, got ${ddata.dryRun}`);
    }
    if (ddata.summary.success !== 0) {
      throw new Error(`A dry run must install nothing; summary.success=${ddata.summary.success}`);
    }
    for (const forbidden of ['counts', 'items']) {
      if (forbidden in ddata) {
        throw new Error(`apply dry-run envelope unexpectedly contains data.${forbidden}`);
      }
    }
    const jqDry = (ddata.actions || []).find((action) => action.id === jqId);
    if (!jqDry) {
      throw new Error(`dry run planned no action for the captured jq app '${jqId}'`);
    }
    if (!PRESENCE_STATUSES.includes(jqDry.status)) {
      throw new Error(`jq dry-run status '${jqDry.status}' is not a presence-reflecting status`);
    }
    console.log(`   ✓ dry-run re-import: dryRun honored, installed nothing, jq → ${jqDry.status}`);

    // 4 + 5) REAL apply scoped to jq with --only, from a single run.
    //   Convergence (step 4): jq is already installed, so it converges without
    //   mutation; to_install is dry-run-only and must never survive a real apply.
    //   Scoping (step 5): --only filters before planning, so the run acts on jq
    //   alone and the other captured app is never planned — therefore never
    //   installed.
    const real = parseEnvelope(
      (await runEndstate('apply', ['--manifest', manifestPath, '--only', jqId])).stdout
    );
    const rdata = real.data || {};
    if (!real.success) {
      throw new Error('Expected a successful scoped apply, got: ' + JSON.stringify(real.error));
    }
    if (rdata.dryRun !== false) {
      throw new Error(`Expected a real apply (dryRun=false), got ${rdata.dryRun}`);
    }
    for (const forbidden of ['counts', 'items']) {
      if (forbidden in rdata) {
        throw new Error(`apply envelope unexpectedly contains data.${forbidden}`);
      }
    }
    const jqReal = (rdata.actions || []).find((action) => action.id === jqId);
    if (!jqReal) {
      throw new Error(`real apply reported no action for jq '${jqId}'`);
    }
    if (!CONVERGED_STATUSES.includes(jqReal.status)) {
      throw new Error(
        `expected jq to converge (${CONVERGED_STATUSES.join('/')}), got '${jqReal.status}'`
      );
    }
    if ((rdata.actions || []).some((action) => action.status === 'to_install')) {
      throw new Error('to_install survived a real apply');
    }
    // --only scoping: exactly jq acted upon; the other captured app is absent.
    const actedIds = (rdata.actions || []).map((action) => action.id);
    if (!(actedIds.length === 1 && actedIds[0] === jqId)) {
      throw new Error(
        `--only ${jqId} did not scope the run to jq alone; acted on ${JSON.stringify(actedIds)}`
      );
    }
    if (actedIds.includes(otherId)) {
      throw new Error(`--only leaked: the unselected captured app '${otherId}' was acted upon`);
    }
    console.log(`   ✓ real apply --only ${jqId}: converged → ${jqReal.status}, no to_install`);
    console.log(`   ✓ --only scoped to jq alone; '${otherId}' never acted upon (never installed)`);
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
    await testProfileInspectionAndRegenerateGolden();
    await testApplyPayloadAndRegenerateGolden();
    await testRestorePayloadAndRegenerateGolden();
    await testMixedPartialFailure();
    await testCaptureApplyRoundtrip();

    console.log('\n✅ All contract tests passed!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Contract test failed:', err.message);
    process.exit(1);
  }
}

runTests();
