// scripts/refresh-engine.mjs
//
// Refreshes the bundled engine binary to the version pinned in ENGINE_VERSION,
// downloading the official signed release asset from Artexis10/endstate and
// verifying its SHA-256 before placing it at the sidecar location.
//
//   Usage: npm run engine:refresh
//
// Why this exists: the bundled binary (src-tauri/binaries/…) is gitignored and
// refreshed by CI on release builds, but a LOCAL checkout can keep a stale
// pre-placed binary after ENGINE_VERSION is bumped — rebuild-engine.cjs skips
// the build whenever a pre-placed binary already exists. CI is unaffected (it
// always downloads the pinned asset fresh). The SHA-256 check makes this immune
// to the engine's unreliable cliVersion reporting (Artexis10/endstate#54).

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pinned = readFileSync(resolve(root, 'ENGINE_VERSION'), 'utf8').trim();
const tag = `v${pinned}`;
const dest = resolve(
  root,
  'src-tauri/binaries/endstate-x86_64-pc-windows-msvc.exe',
);

const work = mkdtempSync(join(tmpdir(), 'engine-refresh-'));
try {
  console.log(`Downloading engine ${tag} from Artexis10/endstate…`);
  // execFileSync (no shell) — args are passed directly, so nothing is
  // interpreted even though `tag`/`work` are interpolated values.
  execFileSync(
    'gh',
    [
      'release', 'download', tag,
      '--repo', 'Artexis10/endstate',
      '--pattern', 'endstate.exe',
      '--pattern', 'endstate.exe.sha256',
      '--dir', work,
      '--clobber',
    ],
    { stdio: 'inherit' },
  );

  const exeBytes = readFileSync(join(work, 'endstate.exe'));
  const expected = readFileSync(join(work, 'endstate.exe.sha256'), 'utf8')
    .trim()
    .split(/\s+/)[0]
    .toLowerCase();
  const actual = createHash('sha256').update(exeBytes).digest('hex').toLowerCase();
  if (expected !== actual) {
    throw new Error(`SHA-256 mismatch — expected ${expected}, got ${actual}`);
  }
  console.log(`SHA-256 verified (${actual.slice(0, 12)}…).`);

  copyFileSync(join(work, 'endstate.exe'), dest);
  console.log(`Placed engine ${tag} at ${dest}`);
  console.log(
    'Run `node scripts/rebuild-engine.cjs` (or restart dev) to refresh the version record.',
  );
} finally {
  rmSync(work, { recursive: true, force: true });
}
