import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
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
    console.log(`PASS ${resolve(installer)}: extracted engine loaded apps.git from ${catalog.moduleCount} packaged modules in read-only dry-run`);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
