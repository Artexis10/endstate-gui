import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

import { sevenZipExecutable, validateCatalogSmokeEnvelope } from './audit-windows-installer.mjs';
import { validateEngineResources } from './engine-resources.mjs';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.status !== 0) {
    const detail = result.error?.message || result.stderr || result.stdout || `${command} exited ${result.status}`;
    throw new Error(detail.trim());
  }
  return result;
}

function parseSuccessfulEnvelope(result, command) {
  let envelope;
  try {
    envelope = JSON.parse(result.stdout.trim());
  } catch (error) {
    throw new Error(`${command} did not return a JSON envelope: ${error.message}`);
  }
  if (envelope?.success !== true || envelope.command !== command || envelope.error !== null) {
    throw new Error(`${command} returned an unsuccessful envelope: ${result.stdout.trim()}`);
  }
  return envelope;
}

function assertPathWithin(label, candidate, root) {
  const offset = relative(resolve(root), resolve(candidate));
  if (offset === '..' || offset.startsWith(`..\\`) || offset.startsWith('../') || isAbsolute(offset)) {
    throw new Error(`${label} escaped the packaged smoke root: ${candidate}`);
  }
}

async function main() {
  const installer = process.argv[2];
  if (!installer || !installer.toLowerCase().endsWith('.exe')) {
    throw new Error('usage: node scripts/smoke-packaged-engine.mjs <nsis-installer.exe>');
  }

  const temporaryRoot = await mkdtemp(join(tmpdir(), 'endstate-packaged-smoke-'));
  try {
    const extractedRoot = join(temporaryRoot, 'extracted');
    run(sevenZipExecutable(), ['x', '-y', `-o${extractedRoot}`, resolve(installer)]);
    const engineExecutable = join(extractedRoot, 'endstate.exe');
    const engineRoot = join(extractedRoot, 'engine');
    if (!existsSync(engineExecutable)) throw new Error('extracted installer is missing endstate.exe');
    const catalog = validateEngineResources(engineRoot);
    const stagedCatalog = validateEngineResources('src-tauri/engine');
    if (catalog.moduleCount !== stagedCatalog.moduleCount) {
      throw new Error(`extracted catalog has ${catalog.moduleCount} modules; expected staged count ${stagedCatalog.moduleCount}`);
    }

    const manifestPath = join(temporaryRoot, 'catalog-smoke.jsonc');
    await writeFile(manifestPath, JSON.stringify({
      version: 1,
      name: 'catalog-smoke',
      apps: [{ id: 'git', refs: { windows: 'Git.Git' } }],
      configModules: ['apps.git'],
    }));

    const result = run(engineExecutable, [
      'apply', '--manifest', manifestPath, '--dry-run', '--only', 'git', '--no-bootstrap', '--json',
    ], {
      env: { ...process.env, ENDSTATE_ROOT: engineRoot },
      timeout: 120_000,
    });
    const envelope = JSON.parse(result.stdout.trim());
    validateCatalogSmokeEnvelope(envelope);

    const portableRoot = join(temporaryRoot, 'captured-fixture');
    const capturedConfigRoot = join(portableRoot, 'configs', 'fixture-legacy');
    const userProfile = join(temporaryRoot, 'home');
    const appData = join(userProfile, 'AppData', 'Roaming');
    const localAppData = join(userProfile, 'AppData', 'Local');
    const restoreTargetRoot = join(appData, 'Fixture Legacy');
    const isolatedTemp = join(temporaryRoot, 'runtime-temp');
    await Promise.all([
      mkdir(capturedConfigRoot, { recursive: true }),
      mkdir(restoreTargetRoot, { recursive: true }),
      mkdir(localAppData, { recursive: true }),
      mkdir(isolatedTemp, { recursive: true }),
    ]);

    const capturedBytes = Buffer.from('{"theme":"captured"}', 'utf8');
    const originalBytes = Buffer.from('{"theme":"original"}', 'utf8');
    const capturedConfigPath = join(capturedConfigRoot, 'settings.json');
    const restoreTargetPath = join(restoreTargetRoot, 'settings.json');
    const restoreManifestPath = join(portableRoot, 'manifest.jsonc');
    await Promise.all([
      writeFile(capturedConfigPath, capturedBytes),
      writeFile(restoreTargetPath, originalBytes),
      writeFile(restoreManifestPath, JSON.stringify({
        version: 1,
        name: 'packaged-captured-fixture',
        apps: [],
        configModules: ['apps.fixture-legacy'],
        restore: [{
          type: 'copy',
          source: './configs/fixture-legacy/settings.json',
          target: '%APPDATA%\\Fixture Legacy\\settings.json',
          backup: true,
          optional: true,
          fromModule: 'apps.fixture-legacy',
        }],
      })),
      writeFile(join(portableRoot, 'metadata.json'), JSON.stringify({
        schemaVersion: '1.0',
        capturedAt: '2026-07-19T00:00:00Z',
        machineName: 'packaged-smoke-fixture',
        endstateVersion: 'fixture',
        configModulesIncluded: ['fixture-legacy'],
        configModulesSkipped: [],
        captureWarnings: [],
      })),
    ]);

    const isolatedEnv = {
      ...process.env,
      ENDSTATE_ROOT: engineRoot,
      APPDATA: appData,
      LOCALAPPDATA: localAppData,
      USERPROFILE: userProfile,
      HOME: userProfile,
      TEMP: isolatedTemp,
      TMP: isolatedTemp,
    };
    const journalRoot = join(engineRoot, 'logs');
    const restoreJournals = async () => existsSync(journalRoot)
      ? (await readdir(journalRoot)).filter(name => name.startsWith('restore-journal-') && name.endsWith('.json')).sort()
      : [];
    const journalsBeforePreview = await restoreJournals();
    if (journalsBeforePreview.length !== 0) {
      throw new Error(`packaged engine unexpectedly contained restore journals: ${journalsBeforePreview.join(', ')}`);
    }
    const sourceBeforePreview = await readFile(capturedConfigPath);
    const targetBeforePreview = await readFile(restoreTargetPath);
    const previewResult = run(engineExecutable, [
      'restore', '--manifest', restoreManifestPath, '--dry-run', '--enable-restore', '--json',
    ], { env: isolatedEnv, cwd: temporaryRoot, timeout: 120_000 });
    const previewEnvelope = parseSuccessfulEnvelope(previewResult, 'restore');
    const previewItems = previewEnvelope.data?.results;
    if (previewEnvelope.data?.dryRun !== true || !Array.isArray(previewItems) || previewItems.length !== 1) {
      throw new Error(`restore dry-run returned ${previewItems?.length ?? 'no'} results; expected exactly one`);
    }
    const previewed = previewItems[0];
    if (previewed.status !== 'restored' || previewed.targetExistedBefore !== true
      || previewed.backupCreated === true || previewed.backupPath) {
      throw new Error(`restore dry-run did not preview one non-mutating replacement: ${JSON.stringify(previewed)}`);
    }
    if (resolve(previewed.source) !== resolve(capturedConfigPath)
      || resolve(previewed.target) !== resolve(restoreTargetPath)) {
      throw new Error(`restore dry-run resolved unexpected paths: ${JSON.stringify(previewed)}`);
    }
    assertPathWithin('restore preview source', previewed.source, portableRoot);
    assertPathWithin('restore preview target', previewed.target, userProfile);
    if (previewEnvelope.data?.journalPath) {
      throw new Error(`restore dry-run unexpectedly reported a journal: ${previewEnvelope.data.journalPath}`);
    }
    if (!sourceBeforePreview.equals(await readFile(capturedConfigPath))
      || !targetBeforePreview.equals(await readFile(restoreTargetPath))) {
      throw new Error('restore dry-run modified the captured source or seeded target');
    }
    const journalsAfterPreview = await restoreJournals();
    if (JSON.stringify(journalsAfterPreview) !== JSON.stringify(journalsBeforePreview)) {
      throw new Error(`restore dry-run mutated restore journals: ${journalsAfterPreview.join(', ')}`);
    }

    const restoreResult = run(engineExecutable, [
      'restore', '--manifest', restoreManifestPath, '--enable-restore', '--json',
    ], { env: isolatedEnv, cwd: temporaryRoot, timeout: 120_000 });
    const restoreEnvelope = parseSuccessfulEnvelope(restoreResult, 'restore');
    const restoreItems = restoreEnvelope.data?.results;
    if (!Array.isArray(restoreItems) || restoreItems.length !== 1) {
      throw new Error(`restore returned ${restoreItems?.length ?? 'no'} results; expected exactly one`);
    }
    const restored = restoreItems[0];
    if (restored.status !== 'restored' || restored.backupCreated !== true || restored.targetExistedBefore !== true) {
      throw new Error(`restore did not replace and back up the seeded target: ${JSON.stringify(restored)}`);
    }
    if (resolve(restored.source) !== resolve(capturedConfigPath) || resolve(restored.target) !== resolve(restoreTargetPath)) {
      throw new Error(`restore used unexpected paths: ${JSON.stringify(restored)}`);
    }
    if (!restored.backupPath || !existsSync(restored.backupPath)) {
      throw new Error(`restore did not create its reported backup: ${restored.backupPath ?? 'missing path'}`);
    }
    const journalPath = restoreEnvelope.data?.journalPath;
    if (!journalPath || !existsSync(journalPath)) {
      throw new Error(`restore did not create its reported journal: ${journalPath ?? 'missing path'}`);
    }
    for (const [label, path, root] of [
      ['restore source', restored.source, portableRoot],
      ['restore target', restored.target, userProfile],
      ['restore backup', restored.backupPath, join(engineRoot, 'state')],
      ['restore journal', journalPath, join(engineRoot, 'logs')],
    ]) {
      assertPathWithin(label, path, root);
    }
    if (!capturedBytes.equals(await readFile(restoreTargetPath))) {
      throw new Error('live restore did not write the captured bytes to the target');
    }
    if (!originalBytes.equals(await readFile(restored.backupPath))) {
      throw new Error('live restore did not back up the exact original target bytes');
    }
    const journal = JSON.parse(await readFile(journalPath, 'utf8'));
    const journalEntries = journal.entries;
    if (!Array.isArray(journalEntries) || journalEntries.length !== 1) {
      throw new Error(`restore journal contained ${journalEntries?.length ?? 'no'} entries; expected exactly one`);
    }
    const journalEntry = journalEntries[0];
    if (journalEntry.action !== 'restored' || journalEntry.backupCreated !== true
      || resolve(journalEntry.resolvedSourcePath) !== resolve(capturedConfigPath)
      || resolve(journalEntry.targetPath) !== resolve(restoreTargetPath)
      || resolve(journalEntry.backupPath) !== resolve(restored.backupPath)) {
      throw new Error(`restore journal did not record the live mutation: ${JSON.stringify(journalEntry)}`);
    }

    const revertResult = run(engineExecutable, ['revert', '--json'], {
      env: isolatedEnv,
      cwd: temporaryRoot,
      timeout: 120_000,
    });
    const revertEnvelope = parseSuccessfulEnvelope(revertResult, 'revert');
    const revertItems = revertEnvelope.data?.results;
    if (!Array.isArray(revertItems) || revertItems.length !== 1) {
      throw new Error(`revert returned ${revertItems?.length ?? 'no'} results; expected exactly one`);
    }
    const reverted = revertItems[0];
    if (reverted.action !== 'reverted' || resolve(reverted.target) !== resolve(restoreTargetPath)
      || resolve(reverted.backupUsed ?? '') !== resolve(restored.backupPath)) {
      throw new Error(`revert did not restore the seeded target: ${JSON.stringify(reverted)}`);
    }
    if (resolve(revertEnvelope.data?.journalUsed ?? '') !== resolve(journalPath)) {
      throw new Error(`revert used an unexpected journal: ${revertEnvelope.data?.journalUsed ?? 'missing path'}`);
    }
    assertPathWithin('revert target', reverted.target, userProfile);
    assertPathWithin('revert journal', revertEnvelope.data.journalUsed, join(engineRoot, 'logs'));
    if (!originalBytes.equals(await readFile(restoreTargetPath))) {
      throw new Error('revert did not restore the exact original target bytes');
    }
    if (!capturedBytes.equals(await readFile(capturedConfigPath))) {
      throw new Error('restore or revert modified the portable captured source');
    }

    console.log(`PASS ${resolve(installer)}: extracted engine loaded apps.git from ${catalog.moduleCount} packaged modules in read-only dry-run; restore preview + live restore + revert stayed inside the temporary root`);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
