import assert from 'node:assert/strict';
import test from 'node:test';

let policyModule;
try {
  policyModule = await import('./ci-bundle-policy.mjs');
} catch {
  policyModule = undefined;
}

test('bundle policy exposes a deterministic decision function', () => {
  assert.equal(typeof policyModule?.decideBundleBuild, 'function');
});

const decideBundleBuild = (...args) => policyModule.decideBundleBuild(...args);

test('manual dispatch always exercises the real installer build', () => {
  assert.deepEqual(
    decideBundleBuild({
      eventName: 'workflow_dispatch',
      headRef: 'release-please--branches--main--components--gui',
      changedFiles: [],
    }),
    { required: true, reason: 'manual bundle verification requested' },
  );
});

test('release-please version PRs defer to the signed draft-release gate', () => {
  assert.deepEqual(
    decideBundleBuild({
      eventName: 'pull_request',
      headRef: 'release-please--branches--main--components--gui',
      prAuthor: 'endstate-release-bot[bot]',
      changedFiles: ['package.json', 'src-tauri/Cargo.toml'],
    }),
    { required: false, reason: 'release PR uses the signed draft-release gate' },
  );
});

test('a lookalike release branch from another author cannot bypass packaging', () => {
  assert.deepEqual(
    decideBundleBuild({
      eventName: 'pull_request',
      headRef: 'release-please--branches--main--components--gui',
      prAuthor: 'untrusted-contributor',
      changedFiles: ['package.json'],
    }),
    { required: true, reason: 'bundle-sensitive files changed' },
  );
});

test('ordinary frontend and documentation changes skip Windows packaging', () => {
  assert.deepEqual(
    decideBundleBuild({
      eventName: 'pull_request',
      headRef: 'fix/frontend-copy',
      changedFiles: ['src/App.tsx', 'docs/ux-language.md'],
    }),
    { required: false, reason: 'no bundle-sensitive files changed' },
  );
});

test('bundle-sensitive path families require Windows packaging', () => {
  const sensitivePaths = [
    'src-tauri/src/lib.rs',
    'ENGINE_VERSION',
    'package.json',
    'package-lock.json',
    'patches/tidewave+0.6.0.patch',
    'scripts/rebuild-engine.cjs',
    'scripts/engine-resources.mjs',
    'scripts/engine-resources.test.mjs',
    'scripts/audit-windows-installer.mjs',
    'scripts/smoke-packaged-engine.mjs',
    'scripts/release-workflow.test.mjs',
    'scripts/ci-bundle-policy.mjs',
    'scripts/ci-bundle-policy.test.mjs',
    'release-please-config.json',
    '.github/workflows/bundle-check.yml',
    '.github/workflows/release-please.yml',
  ];

  for (const changedPath of sensitivePaths) {
    assert.deepEqual(
      decideBundleBuild({
        eventName: 'pull_request',
        headRef: 'ci/harden-layered-checks',
        changedFiles: [changedPath],
      }),
      { required: true, reason: 'bundle-sensitive files changed' },
      changedPath,
    );
  }
});

test('lookalike paths do not accidentally trigger packaging', () => {
  assert.deepEqual(
    decideBundleBuild({
      eventName: 'pull_request',
      headRef: 'docs/examples',
      changedFiles: ['src-tauri-notes/readme.md', 'package.json.example'],
    }),
    { required: false, reason: 'no bundle-sensitive files changed' },
  );
});
