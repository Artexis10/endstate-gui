#!/usr/bin/env node
// openspec_strict_gate.mjs — strict OpenSpec validation with a warning baseline.
//
// Usage:
//   node scripts/openspec_strict_gate.mjs [--write-baseline] -- <openspec command and args...>
//
// The command is invoked as `<cmd...> validate --all --strict --no-interactive --json`
// with OPENSPEC_TELEMETRY=0 from the current working directory (repo root).
// Check mode exits 1 when any ERROR exists or any warning key is not in
// openspec/strict-baseline.json. --write-baseline regenerates that file from the
// current warnings (refuses while ERRORs exist).
//
// Also fails on any git-tracked symlink (mode 120000) under .claude/skills or
// .agents/skills: OpenSpec links .claude/skills on Linux and Windows checkouts
// with core.symlinks=false cannot follow them. Replace each link with a real
// copy of its target directory.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASELINE_PATH = join('openspec', 'strict-baseline.json');
const TOOL_DIRS = ['.claude/skills', '.agents/skills'];

function fail2(msg) {
  console.error(`openspec_strict_gate: internal error: ${msg}`);
  process.exit(2);
}

const argv = process.argv.slice(2);
const writeBaseline = argv.includes('--write-baseline');
const sep = argv.indexOf('--');
if (sep === -1 || sep === argv.length - 1) {
  fail2('usage: openspec_strict_gate.mjs [--write-baseline] -- <openspec command and args...>');
}
const cmd = argv.slice(sep + 1);

function runOpenspec(args, label) {
  const r = spawnSync(cmd[0], [...cmd.slice(1), ...args], {
    cwd: process.cwd(),
    env: { ...process.env, OPENSPEC_TELEMETRY: '0', CI: '1' },
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  if (r.error) fail2(`failed to spawn ${label} command (${cmd.join(' ')}): ${r.error.message}`);
  return r;
}

const verR = runOpenspec(['--version'], 'version');
const version = (verR.stdout || verR.stderr || '').trim().split(/\s+/).pop() || 'unknown';

const r = runOpenspec(['validate', '--all', '--strict', '--no-interactive', '--json'], 'openspec');
let report;
try {
  report = JSON.parse(r.stdout);
} catch {
  fail2(`could not parse JSON from validate stdout (exit ${r.status}):\n${(r.stdout || '').slice(0, 2000)}\n${(r.stderr || '').slice(0, 2000)}`);
}

// Map spec-id -> ordered requirement names from openspec/specs/<id>/spec.md.
// Mirrors MarkdownParser in the validator: BOM/CRLF normalized, fenced code
// masked out, sections nested by header level, and requirements[i] is the i-th
// direct child of the `## Requirements` section — any `###` header there, not
// only `### Requirement:` ones.
function stripClosingSequence(title) {
  return title.replace(/[ \t]+#+[ \t]*$/, '').trim();
}
function buildCodeFenceMask(lines) {
  const mask = new Array(lines.length).fill(false);
  let active = null;
  for (let i = 0; i < lines.length; i++) {
    if (!active) {
      const m = lines[i].match(/^\s*(`{3,}|~{3,})(.*)/);
      if (m && !(m[1][0] === '`' && m[2].includes('`'))) {
        active = { marker: m[1][0], length: m[1].length };
        mask[i] = true;
      }
      continue;
    }
    mask[i] = true;
    const m = lines[i].match(/^\s*(`{3,}|~{3,})\s*$/);
    if (m && m[1][0] === active.marker && m[1].length >= active.length) active = null;
  }
  return mask;
}
function specRequirementNames(specId) {
  const p = join('openspec', 'specs', specId, 'spec.md');
  if (!existsSync(p)) return [];
  const content = readFileSync(p, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const lines = content.split('\n');
  const mask = buildCodeFenceMask(lines);
  // Section tree, as parseSections() builds it.
  const sections = [];
  const stack = [];
  for (let i = 0; i < lines.length; i++) {
    if (mask[i]) continue;
    const m = lines[i].match(/^(#{1,6})\s+(.+)$/);
    if (!m) continue;
    const section = { level: m[1].length, title: stripClosingSequence(m[2]), children: [] };
    while (stack.length > 0 && stack[stack.length - 1].level >= section.level) stack.pop();
    if (stack.length === 0) sections.push(section);
    else stack[stack.length - 1].children.push(section);
    stack.push(section);
  }
  const find = (list) => {
    for (const sec of list) {
      if (sec.title.toLowerCase() === 'requirements') return sec;
      const hit = find(sec.children);
      if (hit) return hit;
    }
    return undefined;
  };
  const reqSection = find(sections);
  if (!reqSection) return [];
  return reqSection.children.map((c) =>
    stripClosingSequence(c.title.replace(/^Requirement:\s*/i, '')),
  );
}
const reqNameCache = new Map();
function requirementName(specId, index) {
  if (!reqNameCache.has(specId)) reqNameCache.set(specId, specRequirementNames(specId));
  const names = reqNameCache.get(specId);
  return index < names.length ? names[index] : `#${index}`;
}

// Collect { key, item } for every non-INFO issue; errors tracked separately.
const warnings = []; // {key, item}
const errors = [];   // {key, item}

for (const item of report.items ?? []) {
  for (const issue of item.issues ?? []) {
    if (issue.level === 'INFO') continue;
    const entry = { item, issue };
    let key;
    if (issue.level === 'ERROR') {
      key = `error ${item.type}/${item.id} :: ${issue.path} :: ${issue.message}`;
      errors.push({ key, ...entry });
      continue;
    }
    const msg = issue.message;
    if (msg.includes('Requirement text is very long')) {
      if (item.type === 'spec') {
        const m = String(issue.path).match(/^requirements\[(\d+)\]$/);
        const name = m ? requirementName(item.id, Number(m[1])) : `#${issue.path}`;
        key = `too-long ${item.id} :: ${name}`;
      } else {
        const m = msg.match(/^(?:ADDED|MODIFIED) "(.+)":/);
        const name = m ? m[1] : msg;
        const capability = String(issue.path).replace(/\/spec\.md$/, '');
        key = `too-long ${capability} :: ${name}`;
      }
    } else {
      key = `warning ${item.type}/${item.id} :: ${issue.path} :: ${msg}`;
    }
    warnings.push({ key, ...entry });
  }
}

const presentKeys = new Set(warnings.map((w) => w.key));

// ---- second gate: tracked symlinks under tool skill dirs ----
const symlinkFailures = [];
const ls = spawnSync('git', ['ls-files', '-s', '--', ...TOOL_DIRS], {
  cwd: process.cwd(),
  encoding: 'utf8',
});
if (ls.error) fail2(`failed to spawn git ls-files: ${ls.error.message}`);
if (ls.status === 0) {
  for (const line of ls.stdout.split('\n')) {
    if (!line.trim()) continue;
    const m = line.match(/^(\d+) [0-9a-f]+ \d+\t(.+)$/);
    if (m && m[1] === '120000') symlinkFailures.push(m[2]);
  }
}
// non-zero status: outside a git repo -> skip silently.

// ---- write-baseline mode ----
if (writeBaseline) {
  if (errors.length > 0) {
    console.error(`Refusing to write baseline: ${errors.length} ERROR-level issue(s):`);
    for (const e of errors) console.error(`  ${e.key}`);
    process.exit(1);
  }
  const keys = [...presentKeys].sort();
  const baseline = {
    openspec_version: version,
    comment:
      'Strict-validation warnings that existed when this repo moved to OpenSpec 2.1.1. ' +
      'CI fails on any warning not listed. Regenerate only to shrink it or to carry a renamed requirement: ' +
      'node scripts/openspec_strict_gate.mjs --write-baseline -- <cmd>',
    keys,
  };
  writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n');
  console.log(`Wrote ${BASELINE_PATH} with ${keys.length} keys (openspec ${version}).`);
  if (symlinkFailures.length > 0) reportSymlinks();
  process.exit(symlinkFailures.length ? 1 : 0);
}

// ---- check mode ----
let baseline;
try {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
} catch {
  fail2(`missing or unparsable baseline ${BASELINE_PATH}; run with --write-baseline`);
}
const baselineKeys = new Set(baseline.keys ?? []);

const newWarnings = warnings.filter((w) => !baselineKeys.has(w.key));
const stale = [...baselineKeys].filter((k) => !presentKeys.has(k));

let failed = false;
if (errors.length > 0) {
  failed = true;
  console.error(`ERROR-level issues (never baselined): ${errors.length}`);
  for (const e of errors) console.error(`  ${e.key}`);
}
if (newWarnings.length > 0) {
  failed = true;
  console.error(`New strict warnings not in baseline: ${newWarnings.length}`);
  for (const w of newWarnings) {
    console.error(`  ${w.key}`);
    console.error(`    from ${w.item.type} "${w.item.id}" (${w.issue.path})`);
  }
}
if (symlinkFailures.length > 0) {
  failed = true;
  reportSymlinks();
}
if (stale.length > 0) {
  console.log(
    `${stale.length} baseline key(s) no longer occur. Shrink the baseline with: ` +
      `node scripts/openspec_strict_gate.mjs --write-baseline -- ${cmd.join(' ')}`,
  );
}
if (!failed) {
  console.log(
    `OK: ${warnings.length} warning(s) all baselined, 0 errors, no tracked skill symlinks (openspec ${version}).`,
  );
}
process.exit(failed ? 1 : 0);

function reportSymlinks() {
  console.error(
    `Tracked symlinks under tool skill dirs: ${symlinkFailures.length}\n` +
      symlinkFailures.map((p) => `  ${p}`).join('\n') +
      `\nOpenSpec links .claude/skills on Linux; Windows checkouts (core.symlinks=false) ` +
      `cannot follow links. Replace each link with a real copy of its target directory.`,
  );
}
