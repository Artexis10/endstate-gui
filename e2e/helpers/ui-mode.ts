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
 * Navigate back to the intent landing page.
 * Clicks the "Back" button if on a flow page (save or setup).
 * No-op if already on the landing page.
 */
export async function goToLanding(page: Page): Promise<void> {
  // Already on landing?
  const onLanding = await page.locator('[data-testid="intent-save"]').isVisible({ timeout: 500 }).catch(() => false);
  if (onLanding) return;

  // Try save-flow back button
  const saveBack = page.locator('[data-testid="save-flow-back"]');
  if (await saveBack.isVisible({ timeout: 500 }).catch(() => false)) {
    await saveBack.click();
    await expect(page.locator('[data-testid="intent-save"]')).toBeVisible({ timeout: 5000 });
    return;
  }

  // Try setup-flow back button
  const setupBack = page.locator('[data-testid="setup-flow-back"]');
  if (await setupBack.isVisible({ timeout: 500 }).catch(() => false)) {
    await setupBack.click();
    await expect(page.locator('[data-testid="intent-save"]')).toBeVisible({ timeout: 5000 });
    return;
  }
}

/**
 * Navigate to Setup flow ("Set up this computer").
 * In the intent-based design, this clicks the intent-setup button
 * on the landing page, entering the SetupFlow component.
 * Works in both Default and Advanced modes (sidebar is hidden on intent pages).
 */
export async function goToApplyPage(page: Page, seedProfiles = true): Promise<void> {
  // If we're already on the setup flow, skip navigation
  const alreadyOnSetup = await page.locator('[data-testid="setup-flow"]').isVisible({ timeout: 500 }).catch(() => false);
  if (alreadyOnSetup) return;

  // Navigate to landing first if we're on another flow
  await goToLanding(page);

  // Click "Set up this computer" on the intent landing page
  const intentSetup = page.locator('[data-testid="intent-setup"]');
  await expect(intentSetup).toBeVisible({ timeout: 5000 });
  await intentSetup.click();

  // Wait for SetupFlow to appear
  await expect(page.locator('[data-testid="setup-flow"]')).toBeVisible({ timeout: 5000 });
}

/**
 * Navigate to Save/Capture flow.
 * In the intent-based design, this clicks "Save this computer" on the landing page,
 * entering the SaveFlow component (which contains capture functionality).
 */
export async function goToCapturePage(page: Page): Promise<void> {
  // If we're already on the save flow, skip navigation
  const alreadyOnSave = await page.locator('[data-testid="save-flow"]').isVisible({ timeout: 500 }).catch(() => false);
  if (alreadyOnSave) return;

  // Navigate to landing first if we're on another flow
  await goToLanding(page);

  // Click "Save this computer" on the intent landing page
  const intentSave = page.locator('[data-testid="intent-save"]');
  await expect(intentSave).toBeVisible({ timeout: 5000 });
  await intentSave.click();

  // Wait for SaveFlow to appear
  await expect(page.locator('[data-testid="save-flow"]')).toBeVisible({ timeout: 5000 });
}

/**
 * Navigate to Verify/Check flow.
 * In the intent-based design, verify is a sub-action within the setup flow.
 * This navigates to the setup flow first.
 */
export async function goToVerifyPage(page: Page): Promise<void> {
  // Verify is part of the setup flow in the intent-based design
  await goToApplyPage(page);
}
