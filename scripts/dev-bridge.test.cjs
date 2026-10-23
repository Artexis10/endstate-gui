// Real listener ownership and request-boundary regression checks.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fork, spawn } = require('node:child_process');
const { once } = require('node:events');
const { createServer, request } = require('node:http');
const { createConnection } = require('node:net');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readSession } = require('./bridge-session.cjs');

const launcherPath = path.join(__dirname, 'run-dev-bridge.cjs');
function launch() {
  // Drain diagnostics so Vite reload output cannot block the child.
  const child = fork(launcherPath, [], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
  const ready = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Launcher readiness timed out')), 90_000);
    child.once('message', message => { clearTimeout(timeout); resolve(message); });
    child.once('error', reject);
    child.once('exit', () => { clearTimeout(timeout); reject(new Error('Launcher exited')); });
  });
  return { child, ready };
}
async function stop(child, signal = 'SIGTERM') {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill(signal);
  await once(child, 'exit');
}
async function invoke(session, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = request(`${session.bridgeUrl}/api/invoke`, { method: 'POST',
      headers: { Authorization: `Bearer ${session.bearer}`, 'Content-Type': 'application/json', ...headers },
      timeout: 5000 }, response => {
      let content = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { content += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, json: async () => JSON.parse(content) }));
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Bridge request timed out')));
    req.end(JSON.stringify(body));
  });
}
async function waitForClosedPort(port) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const open = await new Promise(resolve => {
      const socket = createConnection({ host: '127.0.0.1', port });
      socket.once('connect', () => { socket.destroy(); resolve(true); });
      socket.once('error', () => resolve(false));
    });
    if (!open) return;
    await new Promise(resolve => setTimeout(resolve, 30));
  }
  throw new Error(`Owned port ${port} remained open`);
}

test('bridge refuses missing or invalid private descriptors before binding', async () => {
  const env = { ...process.env };
  delete env.ENDSTATE_BRIDGE_SESSION;
  const target = process.env.CARGO_TARGET_DIR || path.resolve(__dirname, '../src-tauri/target');
  const binary = path.join(target, 'debug', process.platform === 'win32' ? 'endstate-dev-bridge.exe' : 'endstate-dev-bridge');
  for (const descriptor of [undefined, path.join(os.tmpdir(), 'missing-bridge-session.json')]) {
    const child = spawn(binary, [], { env: { ...env, ...(descriptor ? { ENDSTATE_BRIDGE_SESSION: descriptor } : {}) },
      stdio: ['pipe', 'pipe', 'pipe'] });
    const [code] = await once(child, 'exit');
    assert.notEqual(code, 0);
  }
});

test('owned launcher authenticates HTTP and SSE, hides private files, survives Vite restart, and revokes on parent loss', { timeout: 120_000 }, async () => {
  const { child, ready } = launch();
  let descriptorPath;
  const deniedDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-denied-'));
  try {
    ({ descriptorPath } = await ready);
    const session = readSession(descriptorPath);
    const response = await invoke(session, { cmd: 'engine_is_running', args: {} });
    assert.deepEqual(await response.json(), { ok: true, data: false });
    const events = await fetch(`${session.bridgeUrl}/events`, {
      headers: { Authorization: `Bearer ${session.bearer}` }, signal: AbortSignal.timeout(5000) });
    assert.equal(events.status, 200);
    await events.body.cancel();
    const target = path.join(deniedDirectory, 'denied.txt');
    for (const headers of [{ Authorization: '' }, { Authorization: 'Bearer wrong' }, { Origin: 'null' }, { Host: 'untrusted.local' }]) {
      const denied = await invoke(session, { cmd: 'write_text_file', args: { path: target, content: 'synthetic' } }, headers);
      assert.ok([401, 403].includes(denied.status), `Refusal failed for ${Object.keys(headers)} (${denied.status})`);
      assert.equal(fs.existsSync(target), false);
    }
    for (const route of [`/@fs/${descriptorPath}`, '/session.json', '/open-browser.html', '/tidewave', '/tidewave/mcp']) {
      const result = await fetch(`${session.frontendOrigin}${route}`);
      assert.equal((await result.text()).includes(session.bearer), false);
    }
    const tidewave = await fetch(`${session.frontendOrigin}/tidewave`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {
        protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'bridge-test', version: '1' },
      } }),
    });
    assert.equal(tidewave.status, 404, 'Bridge mode must expose no Tidewave HTTP endpoint');
    const frontend = await fetch(session.frontendOrigin);
    assert.equal(frontend.status, 200);
    // Configuration reload must never release the stable frontend listener.
    const config = path.resolve(__dirname, '../vite.config.ts');
    const bytes = fs.readFileSync(config);
    fs.writeFileSync(config, bytes);
    const probeDeadline = Date.now() + 2000;
    while (Date.now() < probeDeadline) {
      const result = await fetch(session.frontendOrigin, { signal: AbortSignal.timeout(5000) });
      assert.equal(result.status, 200);
    }
    assert.equal((await invoke(session, { cmd: 'engine_is_running' })).status, 200);
    await stop(child, 'SIGKILL');
    await waitForClosedPort(9876);
    await waitForClosedPort(1420);
    const restart = launch();
    try {
      const next = readSession((await restart.ready).descriptorPath);
      assert.equal(next.bearer === session.bearer, false);
      assert.equal((await invoke(session, { cmd: 'engine_is_running' })).status, 401);
    } finally { await stop(restart.child); }
  } finally {
    await stop(child);
    fs.rmSync(deniedDirectory, { recursive: true, force: true });
    // Abnormal parent termination cannot clean its private files itself.
    if (descriptorPath) fs.rmSync(path.dirname(descriptorPath), { recursive: true, force: true });
  }
});

for (const port of [1420, 9876]) {
  test(`occupied port ${port} fails startup without sending credentials to its listener`, { timeout: 120_000 }, async () => {
    const requests = [];
    const existing = createServer((req, res) => { requests.push(req.headers.authorization); res.end('existing'); });
    existing.listen(port, '127.0.0.1'); await once(existing, 'listening');
    const child = spawn(process.execPath, [launcherPath], { stdio: ['ignore', 'pipe', 'pipe'] });
    try {
      const [code] = await once(child, 'exit');
      assert.notEqual(code, 0);
      assert.deepEqual(requests, []);
    } finally { await stop(child); await new Promise(resolve => existing.close(resolve)); }
  });
}
