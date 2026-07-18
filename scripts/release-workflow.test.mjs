import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('release-please creates draft releases for pre-publish verification', async () => {
  const config = JSON.parse(await readFile('release-please-config.json', 'utf8'));

  assert.equal(config.draft, true);
});

test('release-please keeps the Rust lockfile package version synchronized', async () => {
  const config = JSON.parse(await readFile('release-please-config.json', 'utf8'));
  const cargoLockUpdater = config['extra-files'].find(
    (entry) => typeof entry === 'object' && entry.path === 'src-tauri/Cargo.lock',
  );

  assert.deepEqual(cargoLockUpdater, {
    type: 'toml',
    path: 'src-tauri/Cargo.lock',
    jsonpath: "$.package[?(@.name.value == 'endstate-gui')].version",
  });
});

test('release workflow publishes only the current package tag as Latest', async () => {
  const workflow = await readFile('.github/workflows/release-please.yml', 'utf8');

  assert.match(workflow, /releaseDraft: true/);
  assert.ok(
    (workflow.match(/--draft=true --prerelease=false --latest=false/g) ?? []).length >= 2,
    'both the pre-build hold and failure backstop must keep the target draft and non-Latest',
  );
  assert.match(workflow, /EXPECTED_TAG=.*gui-v/);
  assert.match(workflow, /if \[ "\$TAG" = "\$EXPECTED_TAG" \]/);
  assert.match(workflow, /--draft=false --prerelease=false --latest/);
  assert.match(workflow, /--draft=false --prerelease=false --latest=false/);
});

test('pull-request CI runs reproducible Rust and production web checks', async () => {
  const workflow = await readFile('.github/workflows/ci.yml', 'utf8');

  assert.match(workflow, /cancel-in-progress: true/);
  assert.match(
    workflow,
    /cargo test --locked --manifest-path src-tauri\/Cargo\.toml -p endstate-engine-core/,
  );
  assert.match(workflow, /npx tsc --noEmit/);
  assert.match(workflow, /npx vite build/);
  assert.match(workflow, /npm run test:ci-policy/);
});

test('bundle workflow always reports a gate and builds Windows only when classified', async () => {
  const workflow = await readFile('.github/workflows/bundle-check.yml', 'utf8');

  assert.match(workflow, /cancel-in-progress: true/);
  assert.match(workflow, /classify-bundle:/);
  assert.match(workflow, /node scripts\/ci-bundle-policy\.mjs/);
  assert.match(workflow, /required: \$\{\{ steps\.policy\.outputs\.required \}\}/);
  assert.match(workflow, /if: needs\.classify-bundle\.outputs\.required == 'true'/);
  assert.match(workflow, /bundle-gate:/);
  assert.match(workflow, /needs: \[classify-bundle, tauri-bundle\]/);
  assert.match(workflow, /if: \$\{\{ always\(\) \}\}/);
});
