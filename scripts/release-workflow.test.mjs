import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

function namedStepBlock(workflow, name) {
  const lines = workflow.replaceAll('\r\n', '\n').split('\n');
  const marker = `      - name: ${name}`;
  const start = lines.indexOf(marker);
  assert.notEqual(start, -1, `missing named step: ${name}`);
  let end = start + 1;
  while (end < lines.length && (lines[end].trim() === '' || /^ {8,}\S/.test(lines[end]))) {
    end += 1;
  }
  return lines.slice(start, end).join('\n');
}

test('release-please creates tagged draft releases for pre-publish verification', async () => {
  const config = JSON.parse(await readFile('release-please-config.json', 'utf8'));

  assert.equal(config.draft, true);
  assert.equal(config['force-tag-creation'], true);
});

test('release workflow runs release automation only for pushes', async () => {
  const workflow = await readFile('.github/workflows/release-please.yml', 'utf8');
  const tokenStep = namedStepBlock(workflow, 'Mint GitHub App installation token');
  const releaseStep = namedStepBlock(workflow, 'Run release-please');

  assert.equal(
    (workflow.match(/uses: googleapis\/release-please-action@v4/g) ?? []).length,
    1,
    'release-please must have one combined invocation',
  );
  assert.match(tokenStep, /\n        if: github\.event_name == 'push'\n/);
  assert.match(tokenStep, /\n        uses: actions\/create-github-app-token@v1\n/);
  assert.match(releaseStep, /\n        if: github\.event_name == 'push'\n/);
  assert.match(releaseStep, /\n        uses: googleapis\/release-please-action@v4\n/);
  assert.match(releaseStep, /\n        id: release\n/);

  assert.match(workflow, /release_created: \$\{\{ steps\.release\.outputs\.release_created \}\}/);
  assert.match(workflow, /tag_name: \$\{\{ steps\.release\.outputs\.tag_name \}\}/);
  assert.match(
    workflow,
    /if: \$\{\{ needs\.release-please\.outputs\.release_created == 'true' \|\| github\.event_name == 'workflow_dispatch' \}\}/,
  );
  assert.match(
    workflow,
    /TAG: \$\{\{ needs\.release-please\.outputs\.tag_name \|\| github\.event\.inputs\.tag_name \}\}/,
  );
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
  assert.match(workflow, /\.changed_files/);
  assert.match(workflow, /previous_filename/);
  assert.match(workflow, /node scripts\/ci-bundle-policy\.mjs/);
  assert.match(workflow, /required: \$\{\{ steps\.policy\.outputs\.required \}\}/);
  assert.match(workflow, /if: needs\.classify-bundle\.outputs\.required == 'true'/);
  assert.match(workflow, /bundle-gate:/);
  assert.match(workflow, /needs: \[classify-bundle, tauri-bundle\]/);
  assert.match(workflow, /if: \$\{\{ always\(\) \}\}/);
  assert.match(workflow, /case "\$BUNDLE_REQUIRED" in/);
  assert.match(workflow, /true\|false\)/);
});
