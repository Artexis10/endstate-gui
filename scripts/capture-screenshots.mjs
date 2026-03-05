/**
 * Capture high-quality screenshots of the app's key screens.
 * Run: node scripts/capture-screenshots.mjs
 * Requires: dev server running at http://127.0.0.1:1420
 */
import { chromium } from 'playwright';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'screenshots');
mkdirSync(outDir, { recursive: true });

const BASE = 'http://127.0.0.1:1420';
const SCALE = 2; // 2x retina

async function main() {
  const browser = await chromium.launch({ headless: true });

  // --- 1. Landing Page (tighter viewport, content is centered) ---
  console.log('1/3  Capturing landing page...');
  const landingCtx = await browser.newContext({
    viewport: { width: 840, height: 620 },
    deviceScaleFactor: SCALE,
    colorScheme: 'dark',
  });
  const landingPage = await landingCtx.newPage();
  await landingPage.goto(BASE, { waitUntil: 'networkidle' });
  await landingPage.waitForSelector('[data-testid="intent-save"]', { timeout: 10000 });
  await landingPage.waitForTimeout(600);
  await landingPage.screenshot({ path: join(outDir, '01-landing.png') });
  console.log('     -> screenshots/01-landing.png');
  await landingCtx.close();

  // --- 2. Save Flow (Scan → Results) ---
  console.log('2/3  Capturing Save flow results...');
  const saveCtx = await browser.newContext({
    viewport: { width: 840, height: 740 },
    deviceScaleFactor: SCALE,
    colorScheme: 'dark',
  });
  const savePage = await saveCtx.newPage();
  await savePage.goto(BASE, { waitUntil: 'networkidle' });
  await savePage.waitForSelector('[data-testid="intent-save"]', { timeout: 10000 });
  await savePage.click('[data-testid="intent-save"]');
  await savePage.waitForSelector('[data-testid="save-flow-start-scan"]', { timeout: 5000 });
  await savePage.waitForTimeout(300);
  await savePage.click('[data-testid="save-flow-start-scan"]');
  await savePage.waitForSelector('[data-testid="save-flow-save-file"]', { timeout: 120000 });
  await savePage.waitForTimeout(600);
  await savePage.screenshot({ path: join(outDir, '02-save-results.png') });
  console.log('     -> screenshots/02-save-results.png');
  await saveCtx.close();

  // --- 3. Setup Flow (Profile → Preview Results) ---
  console.log('3/3  Capturing Setup flow results...');
  const setupCtx = await browser.newContext({
    viewport: { width: 840, height: 820 },
    deviceScaleFactor: SCALE,
    colorScheme: 'dark',
  });
  const setupPage = await setupCtx.newPage();
  await setupPage.goto(BASE, { waitUntil: 'networkidle' });
  await setupPage.waitForSelector('[data-testid="intent-setup"]', { timeout: 10000 });
  await setupPage.click('[data-testid="intent-setup"]');
  await setupPage.waitForSelector('[data-testid="setup-flow"]', { timeout: 5000 });
  await setupPage.waitForTimeout(300);

  const selectBtn = setupPage.locator('[data-testid="setup-flow"] button', { hasText: 'Select' }).first();
  await selectBtn.waitFor({ timeout: 10000 });
  await selectBtn.click();

  const previewDone = setupPage.locator('[data-testid="setup-flow"]').locator('text=Preview complete');
  await previewDone.waitFor({ timeout: 120000 });
  await setupPage.waitForTimeout(600);
  await setupPage.screenshot({ path: join(outDir, '03-setup-results.png') });
  console.log('     -> screenshots/03-setup-results.png');
  await setupCtx.close();

  await browser.close();
  console.log('\nDone! Screenshots saved to screenshots/');
}

main().catch((err) => {
  console.error('Screenshot capture failed:', err.message);
  process.exit(1);
});
