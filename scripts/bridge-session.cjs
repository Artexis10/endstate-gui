// Shared private session storage for the launcher and automation.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { execFileSync } = require('node:child_process');

const { frontendOrigin: FRONTEND_ORIGIN, bridgeUrl: BRIDGE_URL } = require('../src/lib/bridge-protocol.json');

function windowsSecurity(action, target) {
  // Windows PowerShell must discover its own modules after a pwsh parent.
  const childEnv = { ...process.env };
  for (const key of Object.keys(childEnv)) {
    if (key.toUpperCase() === 'PSMODULEPATH') delete childEnv[key];
  }
  const systemRoot = process.env.SystemRoot;
  // A drive-qualified OS path cannot resolve an executable from the caller's directory.
  if (!systemRoot || !path.win32.isAbsolute(systemRoot) ||
      !path.win32.parse(path.win32.normalize(systemRoot)).root.endsWith(':\\')) {
    throw new Error('SystemRoot must be an absolute Windows OS drive path');
  }
  const powershell = path.win32.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  execFileSync(powershell, ['-NoProfile', '-NonInteractive', '-File',
    path.join(__dirname, 'bridge-session-security.ps1'), '-Action', action, '-Target', target],
  { stdio: 'pipe', windowsHide: true, env: childEnv });
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
  let created = false;
  try {
    if (process.platform === 'win32') {
      directory = path.join(parent, `endstate-bridge-${randomBytes(16).toString('hex')}`);
      windowsSecurity('CreateDirectory', directory);
    } else {
      directory = fs.mkdtempSync(path.join(parent, 'endstate-bridge-'));
      created = true;
      fs.chmodSync(directory, 0o700);
    }
    created = true;
    verifyPrivate(directory, true);
    return directory;
  } catch (error) {
    if (created) fs.rmdirSync(directory);
    throw error;
  }
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

function verifySessionStorage(descriptorPath) {
  if (!descriptorPath) throw new Error('Set ENDSTATE_BRIDGE_SESSION to the private session descriptor printed by dev:bridge');
  verifyPrivate(path.dirname(descriptorPath), true);
  verifyPrivate(descriptorPath, false);
}

function readSession(descriptorPath = process.env.ENDSTATE_BRIDGE_SESSION) {
  verifySessionStorage(descriptorPath);
  const session = JSON.parse(fs.readFileSync(descriptorPath, 'utf8'));
  // The session format fixes these endpoints and a 32-byte hexadecimal bearer.
  if (session.version !== 1 || session.frontendOrigin !== FRONTEND_ORIGIN ||
      session.bridgeUrl !== BRIDGE_URL || !/^[a-f0-9]{64}$/.test(session.bearer)) {
    throw new Error('Invalid bridge session descriptor');
  }
  return session;
}

module.exports = { FRONTEND_ORIGIN, BRIDGE_URL,
  createSessionDirectory, writePrivate, readSession };

// The standalone Rust entry point uses the same storage policy before reading authority.
if (require.main === module) {
  try {
    verifySessionStorage(process.argv[2]);
  } catch {
    console.error('Unsafe or missing private bridge session storage');
    process.exitCode = 1;
  }
}
