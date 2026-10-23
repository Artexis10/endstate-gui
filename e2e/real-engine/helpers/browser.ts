import { test as base, expect } from '@playwright/test';
import sessionStorage from '../../../scripts/bridge-session.cjs';

export const test = base.extend({
  page: async ({ page }, use) => {
    const session = sessionStorage.readSession();
    await page.addInitScript(({ origin, key, bearer }) => {
      if (location.origin === origin) window.sessionStorage.setItem(key, bearer);
    }, { origin: session.frontendOrigin, key: sessionStorage.STORAGE_KEY, bearer: session.bearer });
    await use(page);
  },
});
export { expect };
