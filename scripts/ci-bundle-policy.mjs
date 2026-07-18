import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const RELEASE_PLEASE_BRANCH_PREFIX = 'release-please--branches--main--components--';
const RELEASE_PLEASE_BOT = 'endstate-release-bot[bot]';

const BUNDLE_SENSITIVE_FILES = new Set([
  'ENGINE_VERSION',
  'package.json',
  'package-lock.json',
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
]);

const BUNDLE_SENSITIVE_PREFIXES = ['src-tauri/', 'patches/'];

function isBundleSensitive(changedPath) {
  const normalizedPath = String(changedPath).replaceAll('\\', '/');
  return (
    BUNDLE_SENSITIVE_FILES.has(normalizedPath) ||
    BUNDLE_SENSITIVE_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix))
  );
}

export function decideBundleBuild({
  eventName = '',
  headRef = '',
  prAuthor = '',
  changedFiles = [],
} = {}) {
  if (eventName === 'workflow_dispatch') {
    return { required: true, reason: 'manual bundle verification requested' };
  }

  if (headRef.startsWith(RELEASE_PLEASE_BRANCH_PREFIX) && prAuthor === RELEASE_PLEASE_BOT) {
    return { required: false, reason: 'release PR uses the signed draft-release gate' };
  }

  if (changedFiles.some(isBundleSensitive)) {
    return { required: true, reason: 'bundle-sensitive files changed' };
  }

  return { required: false, reason: 'no bundle-sensitive files changed' };
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  const changedFiles = readFileSync(0, 'utf8').split(/\r?\n/u).filter(Boolean);
  const decision = decideBundleBuild({
    eventName: process.env.GITHUB_EVENT_NAME,
    headRef: process.env.GITHUB_HEAD_REF,
    prAuthor: process.env.PR_AUTHOR_LOGIN,
    changedFiles,
  });

  process.stdout.write(`required=${decision.required}\nreason=${decision.reason}\n`);
}
