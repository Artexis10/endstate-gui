#!/usr/bin/env node
/**
 * Fake Endstate engine for the real-spawn fault-injection lane (L3).
 *
 * Mimics `endstate <cmd> --json [--events jsonl]` closely enough to exercise
 * the GUI's REAL spawn path (stdout/stderr/exit-code handling in
 * `src/streaming-runner.ts` and `src-tauri`), WITHOUT the nondeterminism of
 * forcing a real engine to crash. It streams scripted NDJSON to stdout, writes
 * log noise to stderr, and exits with a scripted code.
 *
 * Behaviour is selected by the FAKE_ENGINE_MODE environment variable:
 *   - 'crash-mid-run'  : stream a couple of item events, panic on stderr,
 *                        exit 1 with NO terminal envelope.
 *   - 'malformed-line' : stream a valid item, a malformed/truncated line, then
 *                        finish normally with a valid envelope, exit 0.
 *   - 'hang-then-exit' : stream an item, pause (FAKE_ENGINE_HANG_MS, default
 *                        50), then exit 0 with NO terminal envelope.
 *   - 'garbage'        : write binary/garbage bytes to both streams, exit 1.
 *   - (unset/other)    : healthy run — events + valid envelope, exit 0.
 *
 * The forthcoming gui-real-engine CI lane (L3) points the dev bridge at this
 * script via an engine-path override to prove the real spawn/stderr/exit path
 * never renders a crashed, hung, or garbage run as success. See README.md.
 *
 * This file has NO external dependencies (Node builtins only) so it runs in any
 * environment the engine binary would.
 */
'use strict';

const MODE = process.env.FAKE_ENGINE_MODE || 'healthy';
const RUN_ID = process.env.FAKE_ENGINE_RUN_ID || 'fake-engine-run';
const TIMESTAMP = process.env.FAKE_ENGINE_TIMESTAMP || '2025-01-01T00:00:00.000Z';
const HANG_MS = Number.parseInt(process.env.FAKE_ENGINE_HANG_MS || '50', 10);

/** First non-flag argv token is the command, mirroring `endstate <cmd> ...`. */
function parseCommand(argv) {
  for (const token of argv) {
    if (!token.startsWith('-')) return token;
  }
  return 'apply';
}

const COMMAND = parseCommand(process.argv.slice(2));

function writeOut(line) {
  process.stdout.write(line + '\n');
}

function writeErr(line) {
  process.stderr.write(line + '\n');
}

/** A canonical NDJSON progress event, matching the engine's wire schema. */
function ndjson(event) {
  return JSON.stringify({ version: 1, runId: RUN_ID, timestamp: TIMESTAMP, ...event });
}

function phase(name) {
  return ndjson({ event: 'phase', phase: name });
}

function item(id, status, reason) {
  return ndjson({
    event: 'item',
    id,
    driver: 'winget',
    status,
    reason: reason ?? null,
    name: id,
  });
}

/** A well-formed terminal envelope for the healthy / malformed-recovery paths. */
function successEnvelope() {
  return JSON.stringify({
    schemaVersion: '1.0',
    cliVersion: '0.0.0-fake',
    command: COMMAND,
    runId: RUN_ID,
    timestampUtc: TIMESTAMP,
    success: true,
    data: {
      dryRun: false,
      summary: { total: 2, success: 2, skipped: 0, failed: 0 },
      actions: [
        { id: 'App.One', ref: 'Vendor.AppOne', driver: 'winget', name: 'App One', status: 'installed', reason: '', message: 'Installed', version: '1.0.0', manual: null },
        { id: 'App.Two', ref: 'Vendor.AppTwo', driver: 'winget', name: 'App Two', status: 'installed', reason: '', message: 'Installed', version: '2.0.0', manual: null },
      ],
    },
    error: null,
  });
}

/** Exit after flushing both streams so no scripted bytes are lost. */
function exit(code) {
  let pending = 2;
  const done = () => {
    pending -= 1;
    if (pending === 0) process.exit(code);
  };
  // process.exit can truncate unflushed pipes; wait for drain callbacks.
  const outFlushed = process.stdout.write('');
  const errFlushed = process.stderr.write('');
  if (outFlushed) done(); else process.stdout.once('drain', done);
  if (errFlushed) done(); else process.stderr.once('drain', done);
}

function runCrashMidRun() {
  writeErr('[INFO] starting ' + COMMAND);
  writeOut(phase('apply'));
  writeOut(item('App.One', 'installing'));
  writeOut(item('App.One', 'installed'));
  writeOut(item('App.Two', 'installing'));
  // Engine dies here: panic to stderr, nonzero exit, NO terminal envelope.
  writeErr('panic: runtime error: invalid memory address or nil pointer dereference');
  writeErr('[signal SIGSEGV: segmentation violation]');
  exit(1);
}

function runMalformedLine() {
  writeErr('[INFO] starting ' + COMMAND);
  writeOut(phase('apply'));
  writeOut(item('App.One', 'installed'));
  // A single corrupted/truncated NDJSON line mid-stream. A resilient parser
  // must drop this, not choke — the run still completes normally below.
  writeOut('{"version":1,"event":"item","id":"App.Two","dri');
  writeOut(item('App.Two', 'installed'));
  writeOut(successEnvelope());
  exit(0);
}

function runHangThenExit() {
  writeErr('[INFO] starting ' + COMMAND);
  writeOut(phase('apply'));
  writeOut(item('App.One', 'installing'));
  // Simulate a stall, then exit WITHOUT a terminal envelope (incomplete run).
  setTimeout(() => {
    writeErr('[WARN] engine exiting without completing ' + COMMAND);
    exit(0);
  }, Number.isFinite(HANG_MS) ? HANG_MS : 50);
}

function runGarbage() {
  // Non-UTF8 / control bytes plus broken JSON on both channels.
  process.stdout.write(Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0x7f]));
  writeOut('{not-json ���');
  process.stderr.write(Buffer.from([0xde, 0xad, 0xbe, 0xef]));
  writeErr('\x00\x01 garbage on stderr');
  exit(1);
}

function runHealthy() {
  writeErr('[INFO] starting ' + COMMAND);
  writeOut(phase('apply'));
  writeOut(item('App.One', 'installed'));
  writeOut(item('App.Two', 'installed'));
  writeOut(successEnvelope());
  exit(0);
}

switch (MODE) {
  case 'crash-mid-run':
    runCrashMidRun();
    break;
  case 'malformed-line':
    runMalformedLine();
    break;
  case 'hang-then-exit':
    runHangThenExit();
    break;
  case 'garbage':
    runGarbage();
    break;
  default:
    runHealthy();
    break;
}
