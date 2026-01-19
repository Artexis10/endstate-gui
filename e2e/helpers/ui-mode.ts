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
 * Seeds profiles state directly via E2E hook AFTER page loads.
 * Call this after page.goto() and page.waitForLoadState().
 * This bypasses profile discovery and ensures hasProfile is true.
 * Returns true if seeding succeeded, false if E2E hooks not available.
 */
export async function seedProfilesViaHook(page: Page, profileName = 'test-profile'): Promise<boolean> {
  try {
    await page.waitForFunction(() => (window as any).__endstate_e2e_seedProfiles !== undefined, { timeout: 5000 });
    await page.evaluate(([name]) => {
      (window as any).__endstate_e2e_seedProfiles({
        profiles: [{ name, path: `C:\\test\\profiles\\${name}.jsonc`, displayName: name }],
        selectedProfile: name,
        selectedProfilePath: `C:\\test\\profiles\\${name}.jsonc`,
      });
    }, [profileName]);
    return true;
  } catch {
    // E2E hooks not available - profile discovery must work via mocks
    return false;
  }
}

/**
 * Force Advanced mode (sidebar navigation visible).
 * App starts on Overview; use goToApplyPage() to navigate.
 */
export function forceAdvancedMode(page: Page): Promise<void> {
  return page.addInitScript(() => {
    localStorage.setItem('test:endstate-ui-mode', 'advanced');
    localStorage.setItem('endstate-ui-mode', 'advanced');
    // Also ensure sidebar is visible
    localStorage.setItem('test:endstate-sidebar-visible', 'true');
    localStorage.setItem('endstate-sidebar-visible', 'true');
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
 * In the Overview-centric design, this expands the Apply card.
 * Works in both Default and Advanced modes (both use Overview cards).
 */
export async function goToApplyPage(page: Page, seedProfiles = true): Promise<void> {
  // Seed profiles via E2E hook if requested (ensures hasProfile is true)
  let seeded = false;
  if (seedProfiles) {
    seeded = await seedProfilesViaHook(page, 'test-profile');
  }
  
  // Navigate to Overview first if not already there
  const overviewNav = page.locator('[data-testid="nav-overview"]');
  if (await overviewNav.isVisible({ timeout: 500 }).catch(() => false)) {
    await overviewNav.click();
    await page.waitForTimeout(300);
  }
  
  // Click the Apply card to expand it
  const overviewCard = page.locator('[data-testid="overview-card-apply"]');
  await overviewCard.click();
  
  // Verify expanded content appears
  await expect(page.locator('[data-testid="setup-card-expanded-content"]')).toBeVisible({ timeout: 5000 });
  
  // Wait for Preview/Apply button to be enabled only if we seeded profiles
  // (tests without E2E hooks must handle button enablement themselves)
  if (seeded) {
    const actionButton = page.getByRole('button', { name: /Preview changes|Apply changes/ });
    await expect(actionButton).toBeEnabled({ timeout: 10000 });
  }
}

/**
 * Navigate to Capture page.
 * In the Overview-centric design, this expands the Capture card.
 */
export async function goToCapturePage(page: Page): Promise<void> {
  // Click the capture card to expand it
  const overviewCard = page.locator('[data-testid="overview-card-capture"]');
  await overviewCard.click();
  
  // Wait for the expanded content to appear (contains the Capture button)
  await expect(page.locator('[data-testid="capture-card-expanded-content"]')).toBeVisible({ timeout: 5000 });
}

/**
 * Navigate to Verify page ("Check computer").
 * In the Overview-centric design, this expands the Verify card.
 * Works in both Default and Advanced modes (both use Overview cards).
 */
export async function goToVerifyPage(page: Page): Promise<void> {
  // Navigate to Overview first if not already there
  const overviewNav = page.locator('[data-testid="nav-overview"]');
  if (await overviewNav.isVisible({ timeout: 500 }).catch(() => false)) {
    await overviewNav.click();
    await page.waitForTimeout(300);
  }
  
  // Click the Verify card to expand it
  const overviewCard = page.locator('[data-testid="overview-card-verify"]');
  await overviewCard.click();
  
  // Verify expanded content appears
  await expect(page.locator('[data-testid="check-card-expanded-content"]')).toBeVisible({ timeout: 5000 });
}
