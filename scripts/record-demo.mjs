// scripts/record-demo.mjs
// Record a smooth demo video of the "Set up this computer" flow against the
// browser-bridge dev stack (npm run dev:bridge must already be running).
//
// The recording drives the REAL app with the REAL engine (dry-run preview) and
// stops at the Apply button — it never applies, so the host machine is never
// mutated. Output: WebM (Playwright native) + MP4 (ffmpeg, if available).
//
//   node scripts/record-demo.mjs
//
// Env overrides:
//   DEMO_URL           app URL            (default http://127.0.0.1:1420)
//   DEMO_PROFILES_DIR  profiles folder shown in the app; should contain exactly
//                      the profile(s) you want on camera
//                      (default: %USERPROFILE%\Desktop\endstate-demo-profiles)
//   DEMO_PROFILE_NAME  profile to select  (default starter-fullstack-dev)
//   DEMO_OUT           output directory   (default scripts/../demo-out)

import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL = process.env.DEMO_URL || 'http://127.0.0.1:1420';
const PROFILES_DIR = process.env.DEMO_PROFILES_DIR
  || path.join(os.homedir(), 'Desktop', 'endstate-demo-profiles');
const PROFILE = process.env.DEMO_PROFILE_NAME || 'starter-fullstack-dev';
const OUT = process.env.DEMO_OUT || path.join(repoRoot, 'demo-out');
const SIZE = { width: 1280, height: 800 };

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: SIZE,
  recordVideo: { dir: OUT, size: SIZE },
});

// Seed settings before any app code runs, and suppress toasts for the camera.
await ctx.addInitScript(({ profilesDir, engineScript }) => {
  const KEY = 'web:endstate-gui-settings';
  const existing = JSON.parse(localStorage.getItem(KEY) || '{}');
  // Engine resolution is left to the dev bridge (ENDSTATE_ENGINE_PATH env on
  // the bridge process) — the old endstate.ps1 wrapper no longer exists.
  localStorage.setItem(KEY, JSON.stringify({
    ...existing,
    customProfilesDirectory: profilesDir,
    selectedProfileName: null,
  }));
  // Toasts (session expiry etc.) must not appear on camera. CSS beats a
  // MutationObserver here: React can re-render nodes we remove, but it
  // cannot override an injected !important stylesheet.
  const style = document.createElement('style');
  style.textContent =
    '[data-sonner-toaster], .endstate-sonner { display: none !important; }';
  document.documentElement.appendChild(style);
}, {
  profilesDir: PROFILES_DIR,
  engineScript: path.resolve(repoRoot, '..', 'endstate', 'bin', 'endstate.ps1'),
});

const page = await ctx.newPage();
const hold = (ms) => page.waitForTimeout(ms);

console.log(`[record-demo] opening ${URL} (profiles: ${PROFILES_DIR})`);
await page.goto(URL);
await page.getByRole('button', { name: /Save this computer/i }).waitFor({ timeout: 30_000 });
await hold(900); // hold the landing

if (process.env.DEMO_WITH_CAPTURE === '1') {
  // Prologue: the capture scan with live stage feedback. We show the scan
  // streaming real detections, then return — the setup flow is the main act.
  await page.getByRole('button', { name: /Save this computer/i }).click();
  await hold(1200); // show the capture start view (button visible) before scanning
  const startScan = page.getByRole('button', { name: /scan|start/i }).first();
  try { await startScan.click({ timeout: 4_000 }); } catch { /* scan auto-starts */ }
  await page.getByText(/Scanning|Detected/i).first().waitFor({ timeout: 30_000 });
  // Let the whole real scan play out, then dwell on the results and walk
  // them — the found-apps list and settings-only section are the payoff.
  await page.getByText(/Scan complete/i).waitFor({ timeout: 180_000 });
  await hold(1_200);
  for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, 300); await hold(500); }
  await hold(900);
  await page.getByText(/^Back$/).first().click();
  await page.getByRole('button', { name: /Set up this computer/i }).waitFor({ timeout: 15_000 });
  await hold(800);
}

await page.getByRole('button', { name: /Set up this computer/i }).click();
await page.getByText(/browse or drop a file/i).waitFor({ timeout: 15_000 });
await hold(1000); // show the import surface

// Import the demo bundle through the real file chooser — the same gesture a
// user performs. DEMO_SKIP_IMPORT=1 records against a pre-staged profile
// instead (large bundles currently fail the in-app import silently — the
// known bug — so the on-camera gesture is opt-in).
if (process.env.DEMO_SKIP_IMPORT !== '1') {
  const BUNDLE = process.env.DEMO_BUNDLE_PATH
    || path.join(os.homedir(), 'Desktop', 'endstate-demo-profiles', 'endstate-demo-bundle.zip');
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(BUNDLE);
}

// The imported bundle appears as a row in the (otherwise empty) profiles
// list — select it on camera.
try {
  await page.getByText(PROFILE).first().waitFor({ timeout: 45_000 });
} catch (err) {
  await page.screenshot({ path: path.join(OUT, 'fail-import.png') });
  throw err;
}
await hold(900);
// A freshly imported bundle offers the green "Review setup" primary action;
// pre-listed profiles offer "Select". Click whichever renders — the click
// auto-waits, so a slow extraction of a large bundle cannot race us.
await page.getByRole('button', { name: /Review setup/i })
  .or(page.getByRole('button', { name: 'Select' }))
  .first()
  .click({ timeout: 45_000 });
console.log('[record-demo] waiting for real dry-run preview…');
await page.getByText('Preview complete').waitFor({ timeout: 90_000 });
await hold(900); // let the summary land

for (let i = 0; i < 2; i++) { await page.mouse.wheel(0, 220); await hold(420); } // pan the app list

const restoreRadio = process.env.DEMO_APPS_ONLY === '1'
  ? { count: async () => 0 }
  : page.getByRole('radio', { name: /restore settings/i });
if (await restoreRadio.count()) {
  await restoreRadio.click();
  // The intent switch triggers a second real dry-run; wait it out so the
  // camera never holds on the dimmed re-previewing panel.
  await page.getByText('Preview complete').waitFor({ timeout: 90_000 });
  await hold(1200);
  // Tick the settings module — the consent gesture is the storyboard's beat.
  // Target the module row by its label; the row's checkbox toggles with it.
  const moduleRow = page.getByText('Notepad++', { exact: true }).first();
  if (await moduleRow.count()) { await moduleRow.click(); await hold(1200); }
}

await page.getByRole('button', { name: /Apply changes/i }).hover(); // hover only — never apply
await hold(1400);

await ctx.close();
const video = await page.video().path();
await browser.close();

const webm = path.join(OUT, 'endstate-demo.webm');
fs.copyFileSync(video, webm);
console.log(`[record-demo] webm: ${webm}`);

try {
  const mp4 = path.join(OUT, 'endstate-demo.mp4');
  execFileSync('ffmpeg', ['-y', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
    '-r', '30', '-crf', '20', '-movflags', '+faststart', mp4], { stdio: 'pipe' });
  console.log(`[record-demo] mp4:  ${mp4}`);

  // GIF: two-pass palette for artifact-free color, constant fps, slight speed-up.
  const speed = process.env.DEMO_GIF_SPEED || '1.25';
  const gif = path.join(OUT, 'endstate-demo.gif');
  const chain = `setpts=PTS/${speed},fps=15,scale=960:-1:flags=lanczos,` +
    'split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3';
  execFileSync('ffmpeg', ['-y', '-i', mp4, '-vf', chain, '-loop', '0', gif], { stdio: 'pipe' });
  console.log(`[record-demo] gif:  ${gif} (${speed}x)`);
} catch {
  console.log('[record-demo] ffmpeg not available — webm only.');
}
