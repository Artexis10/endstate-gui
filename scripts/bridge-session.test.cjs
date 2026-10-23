const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { createSessionDirectory, writePrivate, readSession, FRONTEND_ORIGIN, BRIDGE_URL } = require('./bridge-session.cjs');

test('session files have verified owner-only metadata before credentials are written', () => {
  const directory = createSessionDirectory();
  try {
    const descriptor = writePrivate(directory, 'session.json', JSON.stringify({ version: 1,
      frontendOrigin: FRONTEND_ORIGIN, bridgeUrl: BRIDGE_URL, bearer: randomBytes(32).toString('hex') }));
    assert.equal(readSession(descriptor).version, 1);
    assert.throws(() => writePrivate(directory, 'session.json', 'overwrite'));
    if (process.platform !== 'win32') {
      assert.equal(fs.statSync(directory).mode & 0o777, 0o700);
      assert.equal(fs.statSync(descriptor).mode & 0o777, 0o600);
      fs.chmodSync(descriptor, 0o644);
      assert.throws(() => readSession(descriptor), /0700\/0600/);
      fs.chmodSync(descriptor, 0o600);
    }
    const link = path.join(directory, 'link.json');
    if (process.platform !== 'win32') {
      fs.symlinkSync(descriptor, link);
      assert.throws(() => readSession(link), /file type/);
    }
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('Windows storage verification ignores executables in the caller working directory', { skip: process.platform !== 'win32' }, () => {
  const directory = createSessionDirectory();
  try {
    const descriptor = writePrivate(directory, 'session.json', JSON.stringify({ version: 1,
      frontendOrigin: FRONTEND_ORIGIN, bridgeUrl: BRIDGE_URL, bearer: randomBytes(32).toString('hex') }));
    // An empty sentinel makes current-directory executable lookup fail harmlessly.
    fs.writeFileSync(path.join(directory, 'powershell.exe'), '');
    const result = spawnSync(process.execPath, [path.join(__dirname, 'bridge-session.cjs'), descriptor], {
      cwd: directory, encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, '');
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
