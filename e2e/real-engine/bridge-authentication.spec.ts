import { test, expect } from '@playwright/test';
import bridgeSession from '../../scripts/bridge-session.cjs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

test('private bootstrap clears its fragment and retains authenticated invoke and event access after reload', async ({ page }) => {
  const session = bridgeSession.readSession();
  await page.goto('/');
  const bare = await page.evaluate(async () => {
    const bridge = await import('/src/lib/http-bridge.ts');
    try { await bridge.httpInvoke('engine_is_running'); return false; }
    catch (error) { return error instanceof Error && error.message.includes('private browser bootstrap'); }
  });
  expect(bare).toBe(true);
  const bootstrap = path.join(path.dirname(process.env.ENDSTATE_BRIDGE_SESSION!), 'open-browser.html');
  await page.goto(pathToFileURL(bootstrap).href);
  await page.waitForFunction(() => location.hash === '');
  await page.reload();
  const result = await page.evaluate(async () => {
    const bridge = await import('/src/lib/http-bridge.ts');
    return { running: await bridge.httpInvoke('engine_is_running'), available: await bridge.isBridgeAvailable() };
  });
  expect(result).toEqual({ running: false, available: true });
});

test('authenticated browser receives real engine capability events and disposes its event stream', async ({ page }) => {
  const session = bridgeSession.readSession();
  await page.addInitScript(({ key, bearer }) => sessionStorage.setItem(key, bearer),
    { key: bridgeSession.STORAGE_KEY, bearer: session.bearer });
  await page.goto('/');
  const connected = page.waitForResponse(response => response.url().endsWith('/events') && response.status() === 200);
  await page.evaluate(async () => {
    const bridge = await import('/src/lib/http-bridge.ts');
    const state = window as typeof window & { bridgeAuthenticationEvent?: Promise<boolean>; disposeBridgeAuthentication?: () => void };
    state.bridgeAuthenticationEvent = new Promise<boolean>((resolve, reject) => {
      const timeout = setTimeout(() => { state.disposeBridgeAuthentication?.(); reject(new Error('No capability event')); }, 10_000);
      state.disposeBridgeAuthentication = bridge.httpListen('endstate://event', () => {
        clearTimeout(timeout); state.disposeBridgeAuthentication?.(); resolve(true);
      });
    });
  });
  await connected;
  const result = await page.evaluate(async () => {
    const bridge = await import('/src/lib/http-bridge.ts');
    const state = window as typeof window & { bridgeAuthenticationEvent?: Promise<boolean>; disposeBridgeAuthentication?: () => void };
    try {
      await bridge.httpInvoke('engine_run', { exe: '__bundled__', args: ['capabilities', '--json'] });
      return { received: await state.bridgeAuthenticationEvent, hashCleared: location.hash === '' };
    } finally {
      state.disposeBridgeAuthentication?.();
      delete state.bridgeAuthenticationEvent;
      delete state.disposeBridgeAuthentication;
    }
  });
  expect(result).toEqual({ received: true, hashCleared: true });
});


test('event streams reconnect after network loss and stop after an authentication refusal', async ({ page }) => {
  const session = bridgeSession.readSession();
  await page.addInitScript(({ key, bearer }) => sessionStorage.setItem(key, bearer),
    { key: bridgeSession.STORAGE_KEY, bearer: session.bearer });
  await page.goto('/');
  let attempts = 0;
  await page.route('**/events', route => {
    attempts += 1;
    return attempts === 1 ? route.abort() : route.continue();
  });
  const connected = page.waitForResponse(response => response.url().endsWith('/events') && response.status() === 200);
  await page.evaluate(async () => {
    const bridge = await import('/src/lib/http-bridge.ts');
    (window as typeof window & { disposeBridgeAuthentication?: () => void }).disposeBridgeAuthentication = bridge.httpListen('event', () => {});
  });
  await connected;
  expect(attempts).toBe(2);
  await page.evaluate(() => {
    const state = window as typeof window & { disposeBridgeAuthentication?: () => void };
    state.disposeBridgeAuthentication?.(); delete state.disposeBridgeAuthentication;
  });
  await page.unroute('**/events');
  let refusedAttempts = 0;
  page.on('request', request => { if (request.url().endsWith('/events')) refusedAttempts += 1; });
  const refused = page.waitForResponse(response => response.url().endsWith('/events') && response.status() === 401);
  await page.evaluate(async key => {
    sessionStorage.setItem(key, '00'.repeat(32));
    const bridge = await import('/src/lib/http-bridge.ts');
    (window as typeof window & { disposeBridgeAuthentication?: () => void }).disposeBridgeAuthentication = bridge.httpListen('event', () => {});
  }, bridgeSession.STORAGE_KEY);
  await refused;
  // EventSource's ordinary reconnect delay is three seconds; refusal must stop it.
  await page.waitForTimeout(3200);
  expect(refusedAttempts).toBe(1);
  await page.evaluate(() => {
    const state = window as typeof window & { disposeBridgeAuthentication?: () => void };
    state.disposeBridgeAuthentication?.(); delete state.disposeBridgeAuthentication;
  });
});
