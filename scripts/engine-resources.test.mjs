import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { auditInventory } from './audit-windows-installer.mjs';
import { stageEngineResources, validateEngineResources } from './engine-resources.mjs';

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
  assert.match(result.errors.join('\n'), /at least 300 module\.jsonc/);
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
