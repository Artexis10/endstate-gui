import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const PACKAGE_JSON = resolve(root, 'package.json');
const TAURI_CONF = resolve(root, 'src-tauri', 'tauri.conf.json');
const CARGO_TOML = resolve(root, 'src-tauri', 'Cargo.toml');
const CHANGELOG = resolve(root, 'CHANGELOG.md');
const COMPAT_TS = resolve(root, 'src', 'lib', 'compat.ts');

function git(...args) {
  execFileSync('git', args, { cwd: root, stdio: 'inherit' });
}

function readVersion() {
  const pkg = JSON.parse(readFileSync(PACKAGE_JSON, 'utf-8'));
  return pkg.version;
}

function parseSemver(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v);
  if (!m) {
    console.error(`Invalid semver: ${v}`);
    process.exit(1);
  }
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

function bumpVersion(current, type) {
  const { major, minor, patch } = parseSemver(current);
  switch (type) {
    case 'major': return `${major + 1}.0.0`;
    case 'minor': return `${major}.${minor + 1}.0`;
    case 'patch': return `${major}.${minor}.${patch + 1}`;
    default:
      console.error(`Unknown bump type: ${type}`);
      process.exit(1);
  }
}

function writeVersionToPackageJson(version) {
  const pkg = JSON.parse(readFileSync(PACKAGE_JSON, 'utf-8'));
  pkg.version = version;
  writeFileSync(PACKAGE_JSON, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
}

function writeVersionToTauriConf(version) {
  const conf = JSON.parse(readFileSync(TAURI_CONF, 'utf-8'));
  conf.version = version;
  writeFileSync(TAURI_CONF, JSON.stringify(conf, null, 2) + '\n', 'utf-8');
}

function writeVersionToCargoToml(version) {
  const content = readFileSync(CARGO_TOML, 'utf-8');
  const updated = content.replace(
    /^(version\s*=\s*)"[^"]*"/m,
    `$1"${version}"`
  );
  writeFileSync(CARGO_TOML, updated, 'utf-8');
}

function prependChangelog(version) {
  const today = new Date().toISOString().slice(0, 10);
  const content = readFileSync(CHANGELOG, 'utf-8');
  const newSection = `## [${version}] - ${today}\n\n### Added\n\n### Changed\n\n### Fixed\n`;
  const marker = '## [';
  const idx = content.indexOf(marker);
  if (idx === -1) {
    console.error('Could not find changelog section marker');
    process.exit(1);
  }
  const updated = content.slice(0, idx) + newSection + '\n' + content.slice(idx);
  writeFileSync(CHANGELOG, updated, 'utf-8');
}

function updateSchemaCompat(min, max) {
  const content = `export const ENGINE_SCHEMA_COMPAT = {\n  min: "${min}",\n  max: "${max}",\n} as const;\n`;
  writeFileSync(COMPAT_TS, content, 'utf-8');
}

function commitAndTag(version) {
  git('add', '-A');
  git('commit', '-m', `chore: bump version to ${version}`);
  git('tag', `gui-v${version}`);
}

// Parse CLI args
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const filteredArgs = args.filter(a => a !== '--dry-run');

// Handle --schema-compat
const schemaIdx = filteredArgs.indexOf('--schema-compat');
if (schemaIdx !== -1) {
  const val = filteredArgs[schemaIdx + 1];
  if (!val || !/^\d+\.\d+:\d+\.\d+$/.test(val)) {
    console.error('Usage: --schema-compat "min:max" (e.g. "1.0:2.0")');
    process.exit(1);
  }
  const [min, max] = val.split(':');
  if (dryRun) {
    console.log(`[dry-run] Would update ENGINE_SCHEMA_COMPAT: min=${min}, max=${max}`);
  } else {
    updateSchemaCompat(min, max);
    console.log(`Updated ENGINE_SCHEMA_COMPAT: min=${min}, max=${max}`);
  }
  process.exit(0);
}

// Handle --set
const setIdx = filteredArgs.indexOf('--set');
if (setIdx !== -1) {
  const newVersion = filteredArgs[setIdx + 1];
  if (!newVersion || !/^\d+\.\d+\.\d+$/.test(newVersion)) {
    console.error('Usage: --set x.y.z');
    process.exit(1);
  }
  if (dryRun) {
    console.log(`[dry-run] Would set version to ${newVersion} in all files`);
    console.log(`[dry-run] Would prepend changelog entry for ${newVersion}`);
    console.log(`[dry-run] Would create commit: chore: bump version to ${newVersion}`);
    console.log(`[dry-run] Would create tag: gui-v${newVersion}`);
  } else {
    writeVersionToPackageJson(newVersion);
    writeVersionToTauriConf(newVersion);
    writeVersionToCargoToml(newVersion);
    prependChangelog(newVersion);
    commitAndTag(newVersion);
    console.log(`Version set to ${newVersion}`);
  }
  process.exit(0);
}

// Handle bump type (patch, minor, major)
const bumpType = filteredArgs[0];
if (!['patch', 'minor', 'major'].includes(bumpType)) {
  console.error('Usage: bump-version.mjs <patch|minor|major> [--dry-run]');
  console.error('       bump-version.mjs --set x.y.z [--dry-run]');
  console.error('       bump-version.mjs --schema-compat "min:max" [--dry-run]');
  process.exit(1);
}

const current = readVersion();
const newVersion = bumpVersion(current, bumpType);

if (dryRun) {
  console.log(`[dry-run] Current version: ${current}`);
  console.log(`[dry-run] Would bump ${bumpType}: ${current} -> ${newVersion}`);
  console.log(`[dry-run] Would update: package.json, tauri.conf.json, Cargo.toml`);
  console.log(`[dry-run] Would prepend changelog entry for ${newVersion}`);
  console.log(`[dry-run] Would create commit: chore: bump version to ${newVersion}`);
  console.log(`[dry-run] Would create tag: gui-v${newVersion}`);
} else {
  writeVersionToPackageJson(newVersion);
  writeVersionToTauriConf(newVersion);
  writeVersionToCargoToml(newVersion);
  prependChangelog(newVersion);
  commitAndTag(newVersion);
  console.log(`Bumped ${bumpType}: ${current} -> ${newVersion}`);
}
