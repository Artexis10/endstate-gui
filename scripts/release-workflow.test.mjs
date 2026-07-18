import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('release-please creates draft releases for pre-publish verification', async () => {
  const config = JSON.parse(await readFile('release-please-config.json', 'utf8'));

  assert.equal(config.draft, true);
});

test('release workflow publishes only the current package tag as Latest', async () => {
  const workflow = await readFile('.github/workflows/release-please.yml', 'utf8');

  assert.ok(
    (workflow.match(/--draft=true --prerelease=false --latest=false/g) ?? []).length >= 2,
    'both the pre-build hold and failure backstop must keep the target draft and non-Latest',
  );
  assert.match(workflow, /EXPECTED_TAG=.*gui-v/);
  assert.match(workflow, /if \[ "\$TAG" = "\$EXPECTED_TAG" \]/);
  assert.match(workflow, /--draft=false --prerelease=false --latest/);
  assert.match(workflow, /--draft=false --prerelease=false --latest=false/);
});
