import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import * as installerAudit from './audit-windows-installer.mjs';
import { stageEngineResources, validateEngineResources } from './engine-resources.mjs';

const { auditInventory } = installerAudit;

async function makeCatalog(root, count, { schema = true, payload = false } = {}) {
  if (schema) await writeFile(join(root, 'SCHEMA_VERSION'), '1\n');
  for (let index = 0; index < count; index += 1) {
    const moduleDir = join(root, 'modules', 'apps', `app-${String(index).padStart(3, '0')}`);
    await mkdir(moduleDir, { recursive: true });
    await writeFile(join(moduleDir, 'module.jsonc'), '{}\n');
  }
  if (payload) {
    const payloadDir = join(root, 'payload', 'apps', 'user-data');
    await mkdir(payloadDir, { recursive: true });
    await writeFile(join(payloadDir, 'secret.txt'), 'must not bundle\n');
  }
}

test('resource validation rejects incomplete engine catalogs', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'endstate-engine-source-'));
  t.after(() => rm(root, { recursive: true, force: true }));

  await makeCatalog(root, 300, { schema: false });
  assert.throws(() => validateEngineResources(root), /SCHEMA_VERSION/);

  await writeFile(join(root, 'SCHEMA_VERSION'), '1\n');
  await rm(join(root, 'modules'), { recursive: true, force: true });
  await makeCatalog(root, 299);
  assert.throws(() => validateEngineResources(root), /at least 300/);
});

test('resource staging copies only schema and the complete module catalog', async (t) => {
  const source = await mkdtemp(join(tmpdir(), 'endstate-engine-source-'));
  const destination = await mkdtemp(join(tmpdir(), 'endstate-engine-stage-'));
  t.after(() => Promise.all([
    rm(source, { recursive: true, force: true }),
    rm(destination, { recursive: true, force: true }),
  ]));
  await makeCatalog(source, 300, { payload: true });

  const result = await stageEngineResources({ sourceRoot: source, destinationRoot: destination });

  assert.equal(result.moduleCount, 300);
  assert.equal((await readFile(join(destination, 'SCHEMA_VERSION'), 'utf8')).trim(), '1');
  assert.rejects(readFile(join(destination, 'payload', 'apps', 'user-data', 'secret.txt')), /ENOENT/);
  assert.equal(validateEngineResources(destination).moduleCount, 300);
});

test('installer inventory rejects a two-executable package', () => {
  const result = auditInventory(['endstate-gui.exe', 'endstate.exe']);

  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /SCHEMA_VERSION/);
  assert.match(result.errors.join('\n'), /expected exactly 300/);
});

test('installer inventory accepts sidecar, schema, and a sane module catalog', () => {
  const inventory = ['endstate-gui.exe', 'endstate.exe', 'engine/SCHEMA_VERSION'];
  for (let index = 0; index < 300; index += 1) {
    inventory.push(`engine/modules/apps/app-${index}/module.jsonc`);
  }

  const result = auditInventory(inventory);

  assert.equal(result.valid, true, result.errors.join('\n'));
  assert.equal(result.moduleCount, 300);
});

test('installer inventory rejects catalog-shaped files outside runtime engine paths', () => {
  const inventory = ['endstate.exe', 'SCHEMA_VERSION'];
  for (let index = 0; index < 300; index += 1) {
    inventory.push(`decoy/modules/apps/app-${index}/module.jsonc`);
  }

  const result = auditInventory(inventory, 300);

  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /engine\/SCHEMA_VERSION/);
  assert.match(result.errors.join('\n'), /engine\/modules/);
});

test('installer inventory requires the exact staged module count', () => {
  const inventory = ['endstate.exe', 'engine/SCHEMA_VERSION'];
  for (let index = 0; index < 300; index += 1) {
    inventory.push(`engine/modules/apps/app-${index}/module.jsonc`);
  }

  const result = auditInventory(inventory, 365);

  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /300.*exactly 365/);
});

test('MSI inventory reconstruction follows component and directory target paths', () => {
  assert.equal(typeof installerAudit.reconstructMsiInventory, 'function');
  const inventory = installerAudit.reconstructMsiInventory({
    files: [
      { component: 'main', fileName: 'endstate.exe' },
      { component: 'schema', fileName: 'SCHEMA_VERSION' },
      { component: 'git', fileName: 'module.jsonc' },
    ],
    components: [
      { component: 'main', directory: 'INSTALLDIR' },
      { component: 'schema', directory: 'ENGINE' },
      { component: 'git', directory: 'GIT' },
    ],
    directories: [
      { directory: 'INSTALLDIR', parent: 'ProgramFiles64Folder', defaultDir: 'Endstate' },
      { directory: 'ENGINE', parent: 'INSTALLDIR', defaultDir: 'engine' },
      { directory: 'MODULES', parent: 'ENGINE', defaultDir: 'modules' },
      { directory: 'APPS', parent: 'MODULES', defaultDir: 'apps' },
      { directory: 'GIT', parent: 'APPS', defaultDir: 'git' },
    ],
  });

  assert.deepEqual(inventory, [
    'endstate.exe',
    'engine/SCHEMA_VERSION',
    'engine/modules/apps/git/module.jsonc',
  ]);
});

test('catalog smoke envelope requires the pinned restore module to load', () => {
  assert.equal(typeof installerAudit.validateCatalogSmokeEnvelope, 'function');
  assert.doesNotThrow(() => installerAudit.validateCatalogSmokeEnvelope({
    success: true,
    data: { restoreModulesAvailable: [{ id: 'apps.git' }] },
  }));
  assert.throws(
    () => installerAudit.validateCatalogSmokeEnvelope({ success: true, data: {} }),
    /apps\.git/,
  );
});
