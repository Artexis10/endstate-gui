// One launcher owns both listeners and the private launch credential.
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { createServer } = require('node:http');
const { createInterface } = require('node:readline');
const { randomBytes } = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');
const { FRONTEND_ORIGIN, BRIDGE_URL, createSessionDirectory, writePrivate } = require('./bridge-session.cjs');

const repoRoot = path.resolve(__dirname, '..');
const frontendAddress = new URL(FRONTEND_ORIGIN);
const children = new Set();
let frontend;
let vite;
let runtimeDirectory;
let shuttingDown = false;

async function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    child.stdin?.end();
    child.kill();
  }
  await vite?.close();
  frontend?.closeAllConnections();
  await new Promise(resolve => frontend?.listening ? frontend.close(resolve) : resolve());
  if (runtimeDirectory) fs.rmSync(runtimeDirectory, { recursive: true, force: true });
  process.exit(code);
}
process.on('SIGINT', () => void shutdown(0));
process.on('SIGTERM', () => void shutdown(0));
process.on('disconnect', () => void shutdown(0));

async function main() {
  process.env.VITE_BROWSER_BRIDGE = '1';
  process.env.ENDSTATE_BROWSER_BRIDGE = '1';
  frontend = createServer((request, response) => {
    if (request.headers.host !== frontendAddress.host) {
      response.writeHead(403).end();
    } else if (vite) {
      vite.middlewares(request, response, () => response.writeHead(404).end());
    } else {
      response.writeHead(503).end();
    }
  });
  // Acquire the public listener before creating authority; never reuse a server.
  frontend.listen(Number(frontendAddress.port), frontendAddress.hostname);
  await once(frontend, 'listening');
  runtimeDirectory = createSessionDirectory();
  const relative = path.relative(repoRoot, runtimeDirectory);
  if (!relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) {
    throw new Error('Bridge session directory must be outside the served repository');
  }
  const session = { version: 1, frontendOrigin: FRONTEND_ORIGIN, bridgeUrl: BRIDGE_URL,
    bearer: randomBytes(32).toString('hex') };
  const descriptorPath = writePrivate(runtimeDirectory, 'session.json', JSON.stringify(session));

  const cargo = spawn('cargo', ['build', '--locked', '--manifest-path', 'src-tauri/Cargo.toml', '-p', 'endstate-dev-bridge', '-j', '2'],
    { cwd: repoRoot, stdio: 'inherit' });
  children.add(cargo);
  const [code] = await once(cargo, 'exit');
  children.delete(cargo);
  if (code !== 0) throw new Error('Bridge build failed');
  const binary = path.resolve(process.env.CARGO_TARGET_DIR || path.join(repoRoot, 'src-tauri/target'), 'debug',
    process.platform === 'win32' ? 'endstate-dev-bridge.exe' : 'endstate-dev-bridge');
  const env = { ...process.env, ENDSTATE_BRIDGE_SESSION: descriptorPath };
  const siblingEngine = path.resolve(repoRoot, '../endstate');
  if (!env.ENDSTATE_ROOT && fs.existsSync(siblingEngine)) env.ENDSTATE_ROOT = siblingEngine;
  const bridge = spawn(binary, [], { cwd: repoRoot, env, stdio: ['pipe', 'pipe', 'inherit'] });
  children.add(bridge);
  const bound = new Promise((resolve, reject) => {
    const lines = createInterface({ input: bridge.stdout });
    const timeout = setTimeout(() => reject(new Error('Bridge bind handshake timed out')), 30_000);
    lines.once('line', line => {
      clearTimeout(timeout);
      if (line === 'ENDSTATE_BRIDGE_BOUND_V1') resolve();
      else reject(new Error('Invalid bridge bind handshake'));
    });
    bridge.once('error', reject);
    bridge.once('exit', () => { clearTimeout(timeout); reject(new Error('Bridge exited before readiness')); });
  });
  bridge.once('exit', () => { if (!shuttingDown) void shutdown(1); });
  await bound;
  // Readiness stays on the owned pipe; no HTTP readiness request carries authority.

  const { createServer: createViteServer } = await import('vite');
  vite = await createViteServer({ root: repoRoot, server: { middlewareMode: true,
    hmr: { server: frontend }, fs: { strict: true, allow: [repoRoot] } } });
  const destination = `${FRONTEND_ORIGIN}/#endstate-bridge=${encodeURIComponent(session.bearer)}`;
  const bootstrapPath = writePrivate(runtimeDirectory, 'open-browser.html',
    `<!doctype html><meta name="referrer" content="no-referrer"><title>Endstate bridge</title><script>location.replace(${JSON.stringify(destination)})</script>`);
  console.log(`[dev:bridge] Ready. Private browser bootstrap: ${bootstrapPath}`);
  console.log(`[dev:bridge] Session descriptor: ${descriptorPath}`);
  process.send?.({ type: 'ready', descriptorPath, bootstrapPath });
}
main().catch(error => {
  console.error(`[dev:bridge] ${error.message}`);
  void shutdown(1);
});
