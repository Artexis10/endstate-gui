import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const PACKAGE_JSON = resolve(root, 'package.json');
const TAURI_CONF = resolve(root, 'src-tauri', 'tauri.conf.json');
const CARGO_TOML = resolve(root, 'src-tauri', 'Cargo.toml');
const COMPAT_TS = resolve(root, 'src', 'lib', 'compat.ts');

let errors = 0;

// Read versions
const pkgVersion = JSON.parse(readFileSync(PACKAGE_JSON, 'utf-8')).version;
const tauriVersion = JSON.parse(readFileSync(TAURI_CONF, 'utf-8')).version;

const cargoContent = readFileSync(CARGO_TOML, 'utf-8');
const cargoMatch = /^version\s*=\s*"([^"]*)"/m.exec(cargoContent);
const cargoVersion = cargoMatch ? cargoMatch[1] : null;

console.log(`package.json:     ${pkgVersion}`);
console.log(`tauri.conf.json:  ${tauriVersion}`);
console.log(`Cargo.toml:       ${cargoVersion}`);

// Validate semver format
const semverRe = /^\d+\.\d+\.\d+$/;
for (const [name, ver] of [['package.json', pkgVersion], ['tauri.conf.json', tauriVersion], ['Cargo.toml', cargoVersion]]) {
  if (!ver || !semverRe.test(ver)) {
    console.error(`ERROR: ${name} has invalid semver: ${ver}`);
    errors++;
  }
}

// Check all match
if (pkgVersion !== tauriVersion) {
  console.error(`ERROR: package.json (${pkgVersion}) != tauri.conf.json (${tauriVersion})`);
  errors++;
}
if (pkgVersion !== cargoVersion) {
  console.error(`ERROR: package.json (${pkgVersion}) != Cargo.toml (${cargoVersion})`);
  errors++;
}

// Validate compat.ts format
const compatContent = readFileSync(COMPAT_TS, 'utf-8');
const compatRe = /min:\s*"(\d+\.\d+)"[\s\S]*max:\s*"(\d+\.\d+)"/;
const compatMatch = compatRe.exec(compatContent);
if (!compatMatch) {
  console.error('ERROR: compat.ts has invalid ENGINE_SCHEMA_COMPAT format');
  errors++;
} else {
  console.log(`compat.ts:        min=${compatMatch[1]}, max=${compatMatch[2]}`);
}

if (errors > 0) {
  console.error(`\nVersion sync check FAILED with ${errors} error(s).`);
  process.exit(1);
} else {
  console.log('\nAll versions in sync. OK.');
  process.exit(0);
}
