/**
 * Contract test for the fake engine (tests/fake-engine/fake-engine.cjs).
 *
 * The fake stands in for the real `endstate` binary in the forthcoming L3
 * gui-real-engine lane, so its scripted stdout/stderr/exit behaviour must
 * itself be pinned. This is a STANDALONE Node test (node:test) — it does not
 * touch tests/contract.test.js and is not wired into `npm run test:contract`.
 *
 * Run:  node --test tests/fake-engine/fake-engine.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FAKE = path.join(HERE, 'fake-engine.cjs');

/** Spawn the fake with a given mode; resolve with exit code + raw output. */
function runFake(mode, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [FAKE, 'apply', '--json', '--events', 'jsonl'], {
      env: { ...process.env, FAKE_ENGINE_MODE: mode, ...extraEnv },
    });
    const out = [];
    const err = [];
    child.stdout.on('data', (d) => out.push(d));
    child.stderr.on('data', (d) => err.push(d));
    child.on('error', reject);
    child.on('close', (code) => {
      resolve({
        code,
        stdout: Buffer.concat(out).toString('utf8'),
        stderr: Buffer.concat(err).toString('utf8'),
        stdoutRaw: Buffer.concat(out),
      });
    });
  });
}

/** Pull the last `{`-prefixed line and try to parse it as the terminal envelope. */
function terminalEnvelope(stdout) {
  const lines = stdout.split('\n').map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i].startsWith('{')) continue;
    try {
      const parsed = JSON.parse(lines[i]);
      if (parsed && typeof parsed === 'object' && 'schemaVersion' in parsed && 'success' in parsed) {
        return parsed;
      }
    } catch {
      /* keep scanning backwards */
    }
  }
  return null;
}

test('crash-mid-run: nonzero exit, panic on stderr, and NO terminal envelope', async () => {
  const { code, stdout, stderr } = await runFake('crash-mid-run');
  assert.notEqual(code, 0, 'crash must exit nonzero');
  assert.equal(code, 1);
  assert.match(stderr, /panic/i, 'stderr should carry the panic');
  assert.equal(terminalEnvelope(stdout), null, 'a crashed run must not emit a success envelope');
  // It did make progress before dying (proves "mid-run").
  assert.match(stdout, /"event":"item"/, 'should have streamed at least one item event');
});

test('malformed-line: drops the bad line but still finishes with a success envelope', async () => {
  const { code, stdout } = await runFake('malformed-line');
  assert.equal(code, 0);
  // The corrupted/truncated line is present in the raw stream ...
  assert.match(stdout, /"id":"App\.Two","dri$/m, 'the truncated line should be emitted verbatim');
  // ... yet the run recovers and ends with a valid terminal envelope.
  const envelope = terminalEnvelope(stdout);
  assert.ok(envelope, 'malformed-line mode must still emit a terminal envelope');
  assert.equal(envelope.success, true);
  assert.equal(envelope.data.summary.failed, 0);
});

test('hang-then-exit: exits 0 but with NO terminal envelope (incomplete run)', async () => {
  const start = Date.now();
  const { code, stdout } = await runFake('hang-then-exit', { FAKE_ENGINE_HANG_MS: '120' });
  const elapsed = Date.now() - start;
  assert.equal(code, 0);
  assert.equal(terminalEnvelope(stdout), null, 'a run that exits without a summary must not look successful');
  assert.match(stdout, /"event":"item"/, 'should have streamed progress before exiting');
  assert.ok(elapsed >= 100, `should have paused before exiting (elapsed ${elapsed}ms)`);
});

test('garbage: nonzero exit and no parseable terminal envelope', async () => {
  const { code, stdout, stdoutRaw } = await runFake('garbage');
  assert.equal(code, 1);
  assert.equal(terminalEnvelope(stdout), null, 'garbage output must never parse into a success envelope');
  assert.ok(stdoutRaw.length > 0, 'should have written some bytes');
  assert.ok(stdoutRaw.includes(0x00), 'garbage stream should contain non-text bytes');
});

test('healthy (default mode): valid success envelope, exit 0', async () => {
  const { code, stdout } = await runFake('healthy');
  assert.equal(code, 0);
  const envelope = terminalEnvelope(stdout);
  assert.ok(envelope, 'healthy mode should emit a terminal envelope');
  assert.equal(envelope.success, true);
  assert.equal(envelope.command, 'apply', 'command should echo the argv command');
});
