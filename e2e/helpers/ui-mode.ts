import { Page, expect } from '@playwright/test';

/**
 * E2E Helpers for UI mode and navigation
 * 
 * The app stores UI mode in localStorage with key 'test:endstate-ui-mode'
 * (namespaced with 'test:' prefix when VITE_STORAGE_NS=test).
 * 
 * App always starts on Overview page regardless of UI mode.
 * Tests must navigate explicitly to other pages.
 */

/**
 * Seeds settings with a pre-selected profile IF not already set.
 * Call this via addInitScript BEFORE page.goto().
 * Uses seed-if-missing to avoid clobbering tests that assert persistence.
 */
export function seedProfileSettings(page: Page, profileName = 'test-profile', dryRunEnabled = true): Promise<void> {
  return page.addInitScript(([name, dryRun]) => {
    // Only seed if settings don't already exist (seed-if-missing)
    const existingSettings = localStorage.getItem('test:endstate-gui-settings') || localStorage.getItem('endstate-gui-settings');
    if (existingSettings) return;
    
    const settings = {
      engineMode: 'path',
      engineScriptPath: '',
      customProfilesDirectory: '',
      lastSelectedProfile: name,
      lastSelectedProfilePath: `C:\\test\\profiles\\${name}.jsonc`,
      dryRunEnabled: dryRun,
    };
    localStorage.setItem('test:endstate-gui-settings', JSON.stringify(settings));
    localStorage.setItem('endstate-gui-settings', JSON.stringify(settings));
  }, [profileName, dryRunEnabled]);
}

/**
 * Force Advanced mode (sidebar navigation visible).
 * App starts on Overview; use goToApplyPage() to navigate.
 */
export function forceAdvancedMode(page: Page): Promise<void> {
  return page.addInitScript(() => {
    localStorage.setItem('test:endstate-ui-mode', 'advanced');
    localStorage.setItem('endstate-ui-mode', 'advanced');
  });
}

/**
 * Force Default mode (Overview screen, no sidebar).
 */
export function forceDefaultMode(page: Page): Promise<void> {
  return page.addInitScript(() => {
    localStorage.setItem('test:endstate-ui-mode', 'default');
    localStorage.setItem('endstate-ui-mode', 'default');
  });
}

/**
 * Navigate to Apply page ("Set up computer").
 * Works in both Default mode (clicks Overview card) and Advanced mode (clicks sidebar nav).
 */
export async function goToApplyPage(page: Page): Promise<void> {
  // Try sidebar nav first (Advanced mode), fall back to Overview card (Default mode)
  const sidebarNav = page.locator('[data-testid="nav-apply"]');
  const overviewCard = page.locator('[data-testid="overview-card-apply"]');
  
  if (await sidebarNav.isVisible({ timeout: 500 }).catch(() => false)) {
    await sidebarNav.click();
  } else {
    await overviewCard.click();
  }
  await expect(page.locator('h1:has-text("Set up computer")')).toBeVisible({ timeout: 5000 });
}

/**
 * Navigate to Capture page.
 * Works in both Default mode (clicks Overview card) and Advanced mode (clicks sidebar nav).
 */
export async function goToCapturePage(page: Page): Promise<void> {
  const sidebarNav = page.locator('[data-testid="nav-capture"]');
  const overviewCard = page.locator('[data-testid="overview-card-capture"]');
  
  if (await sidebarNav.isVisible({ timeout: 500 }).catch(() => false)) {
    await sidebarNav.click();
  } else {
    await overviewCard.click();
  }
  await expect(page.locator('h1:has-text("Capture computer")')).toBeVisible({ timeout: 5000 });
}

/**
 * Navigate to Verify page ("Check computer").
 * Works in both Default mode (clicks Overview card) and Advanced mode (clicks sidebar nav).
 */
export async function goToVerifyPage(page: Page): Promise<void> {
  const sidebarNav = page.locator('[data-testid="nav-verify"]');
  const overviewCard = page.locator('[data-testid="overview-card-verify"]');
  
  if (await sidebarNav.isVisible({ timeout: 500 }).catch(() => false)) {
    await sidebarNav.click();
  } else {
    await overviewCard.click();
  }
  await expect(page.locator('h1:has-text("Check computer")')).toBeVisible({ timeout: 5000 });
}
