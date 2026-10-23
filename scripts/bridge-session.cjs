// Shared private session storage for the launcher and automation.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { execFileSync } = require('node:child_process');

const { frontendOrigin: FRONTEND_ORIGIN, bridgeUrl: BRIDGE_URL, storageKey: STORAGE_KEY } = require('../src/lib/bridge-protocol.json');

function windowsSecurity(action, target) {
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File',
    path.join(__dirname, 'bridge-session-security.ps1'), '-Action', action, '-Target', target],
  { stdio: 'pipe', windowsHide: true });
}

function verifyPrivate(target, directory) {
  const stat = fs.lstatSync(target);
  if (stat.isSymbolicLink() || (directory ? !stat.isDirectory() : !stat.isFile())) {
    throw new Error('Bridge session storage has an unsafe file type');
  }
  if (process.platform === 'win32') {
    windowsSecurity('Verify', target);
  } else if (stat.uid !== process.getuid() || (stat.mode & 0o777) !== (directory ? 0o700 : 0o600)) {
    throw new Error('Bridge session storage must be owned by this user with mode 0700/0600');
  }
}

function createSessionDirectory() {
  const parent = fs.realpathSync(os.tmpdir());
  let directory;
  if (process.platform === 'win32') {
    directory = path.join(parent, `endstate-bridge-${randomBytes(16).toString('hex')}`);
    windowsSecurity('CreateDirectory', directory);
  } else {
    directory = fs.mkdtempSync(path.join(parent, 'endstate-bridge-'));
    fs.chmodSync(directory, 0o700);
  }
  verifyPrivate(directory, true);
  return directory;
}

function writePrivate(directory, name, content) {
  verifyPrivate(directory, true);
  const target = path.join(directory, name);
  const fd = fs.openSync(target, 'wx', 0o600);
  try {
    if (process.platform === 'win32') windowsSecurity('ProtectFile', target);
    verifyPrivate(target, false);
    fs.writeFileSync(fd, content);
  } finally {
    fs.closeSync(fd);
  }
  return target;
}

function readSession(descriptorPath = process.env.ENDSTATE_BRIDGE_SESSION) {
  if (!descriptorPath) throw new Error('Set ENDSTATE_BRIDGE_SESSION to the private session descriptor printed by dev:bridge');
  verifyPrivate(path.dirname(descriptorPath), true);
  verifyPrivate(descriptorPath, false);
  const session = JSON.parse(fs.readFileSync(descriptorPath, 'utf8'));
  // The session format fixes these endpoints and a 32-byte hexadecimal bearer.
  if (session.version !== 1 || session.frontendOrigin !== FRONTEND_ORIGIN ||
      session.bridgeUrl !== BRIDGE_URL || !/^[a-f0-9]{64}$/.test(session.bearer)) {
    throw new Error('Invalid bridge session descriptor');
  }
  return session;
}

module.exports = { FRONTEND_ORIGIN, BRIDGE_URL, STORAGE_KEY,
  createSessionDirectory, writePrivate, verifyPrivate, readSession };
