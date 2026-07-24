// Guards the NSIS install-time contract for engine resources.
//
// NSIS overwrites files in place and never removes ones that disappeared
// between versions, so the engine module catalog has to be cleared before it is
// re-extracted. Without that, a module deleted upstream survives every in-place
// upgrade — which is how a stale apps/wsl-config resurrected a restore-target
// collision and hard-failed capture (Artexis10/endstate#191).
//
// The prune must stay scoped to engine\modules: engine\state holds user data
// (apply backups, generations, schedule) that an upgrade must preserve.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const template = readFileSync(resolve(root, 'src-tauri/windows/installer.nsi'), 'utf8');

function installSection() {
  const start = template.indexOf('Section Install');
  assert.notEqual(start, -1, 'installer.nsi has no "Section Install"');
  const end = template.indexOf('SectionEnd', start);
  assert.notEqual(end, -1, 'Section Install is never closed');
  return template.slice(start, end);
}

test('install clears the engine module catalog before extracting resources', () => {
  const section = installSection();
  const prune = section.indexOf(String.raw`RMDir /r "$INSTDIR\engine\modules"`);
  assert.notEqual(
    prune,
    -1,
    'Section Install must clear $INSTDIR\\engine\\modules so upgrades cannot keep modules deleted upstream',
  );

  const resources = section.indexOf('{{#each resources}}');
  assert.notEqual(resources, -1, 'Section Install no longer extracts resources');
  assert.ok(
    prune < resources,
    'the catalog prune must run before resources are extracted, otherwise it deletes the freshly shipped catalog',
  );
});

test('install never deletes user-owned engine state', () => {
  const section = installSection();
  assert.ok(
    !/RMDir\s+\/r\s+"\$INSTDIR\\engine\\state/i.test(section),
    'engine\\state holds apply backups, generations and schedule — an upgrade must never delete it',
  );
  assert.ok(
    !/RMDir\s+\/r\s+"\$INSTDIR\\engine"/i.test(section),
    'pruning all of $INSTDIR\\engine would take engine\\state with it; scope the prune to engine\\modules',
  );
  assert.ok(
    !/RMDir\s+\/r\s+"\$INSTDIR"/i.test(section),
    'Section Install must not wipe the whole install directory',
  );
});
