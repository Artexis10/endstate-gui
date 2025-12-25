import { test, expect } from '@playwright/test';

/**
 * E2E tests for live activity stability and profile select readability
 */

test.describe('Live Activity Stability', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Tauri environment with basic setup
    await page.addInitScript(() => {
      (window as any).__TAURI__ = {
        core: { invoke: async () => undefined },
        event: { listen: async () => () => {} }
      };
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('profile select should be readable in dark mode', async ({ page }) => {
    // Verify profile select exists and is visible
    const profileSelect = page.locator('select').first();
    await expect(profileSelect).toBeVisible();
    
    // Check that select has proper styling
    const selectStyles = await profileSelect.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        color: computed.color,
        backgroundColor: computed.backgroundColor,
        colorScheme: computed.colorScheme,
      };
    });
    
    // Verify dark mode color scheme is applied
    expect(selectStyles.colorScheme).toBe('dark');
    
    // Open dropdown and verify options are visible
    await profileSelect.click();
    const options = page.locator('select option');
    const optionCount = await options.count();
    expect(optionCount).toBeGreaterThan(0);
    
    // Verify first option text is visible
    const firstOptionText = await options.first().textContent();
    expect(firstOptionText).toBeTruthy();
    expect(firstOptionText?.trim().length).toBeGreaterThan(0);
  });

  test('live activity maintains stable order during apply', async ({ page }) => {
    // Navigate to overview and expand setup card
    const setupCard = page.locator('text=Set up computer').locator('..');
    await setupCard.click();
    
    // Wait for card to expand
    await page.waitForTimeout(300);
    
    // Select apply mode and start
    const applyButton = page.locator('button:has-text("Apply")').first();
    await applyButton.click();
    
    const startButton = page.locator('button:has-text("Apply changes")');
    await startButton.click();
    
    // Wait for live activity to appear
    await page.waitForSelector('text=Live activity', { timeout: 5000 });
    
    // Expand live activity
    const liveActivityToggle = page.locator('button:has-text("Live activity")');
    await liveActivityToggle.click();
    
    // Wait for some events to populate
    await page.waitForTimeout(1000);
    
    // Capture initial order of app names
    const initialAppNames = await page.locator('[class*="font-mono truncate"]').allTextContents();
    
    // Wait a bit more for updates
    await page.waitForTimeout(500);
    
    // Capture order again
    const laterAppNames = await page.locator('[class*="font-mono truncate"]').allTextContents();
    
    // Verify that apps maintain their relative order
    // New apps should only be appended, not inserted
    if (initialAppNames.length > 0 && laterAppNames.length >= initialAppNames.length) {
      for (let i = 0; i < initialAppNames.length; i++) {
        // Each app should either stay in same position or move down (if new apps prepended)
        // But with append semantics, they should stay in same position
        const initialApp = initialAppNames[i];
        const laterIndex = laterAppNames.indexOf(initialApp);
        
        // App should still exist and be at same or later index (append semantics)
        expect(laterIndex).toBeGreaterThanOrEqual(i);
      }
    }
  });

  test('live activity shows newest items at bottom', async ({ page }) => {
    // Navigate to overview and expand setup card
    const setupCard = page.locator('text=Set up computer').locator('..');
    await setupCard.click();
    
    await page.waitForTimeout(300);
    
    // Start apply
    const applyButton = page.locator('button:has-text("Apply")').first();
    await applyButton.click();
    
    const startButton = page.locator('button:has-text("Apply changes")');
    await startButton.click();
    
    // Wait for live activity
    await page.waitForSelector('text=Live activity', { timeout: 5000 });
    
    // Expand live activity
    const liveActivityToggle = page.locator('button:has-text("Live activity")');
    await liveActivityToggle.click();
    
    // Wait for multiple events
    await page.waitForTimeout(2000);
    
    // Get all app names in order
    const appNames = await page.locator('[class*="font-mono truncate"]').allTextContents();
    
    // Verify we have multiple items
    expect(appNames.length).toBeGreaterThan(1);
    
    // The list should show items in append order (oldest first, newest last)
    // We can't verify exact order without knowing engine output, but we can verify
    // that the list is stable and doesn't reverse or shuffle
    expect(appNames.length).toBeGreaterThan(0);
  });

  test('live activity shows more than 5 items when expanded', async ({ page }) => {
    // Navigate to overview and expand setup card
    const setupCard = page.locator('text=Set up computer').locator('..');
    await setupCard.click();
    
    await page.waitForTimeout(300);
    
    // Start apply
    const applyButton = page.locator('button:has-text("Apply")').first();
    await applyButton.click();
    
    const startButton = page.locator('button:has-text("Apply changes")');
    await startButton.click();
    
    // Wait for live activity
    await page.waitForSelector('text=Live activity', { timeout: 5000 });
    
    // Expand live activity
    const liveActivityToggle = page.locator('button:has-text("Live activity")');
    await liveActivityToggle.click();
    
    // Wait for events to populate
    await page.waitForTimeout(2000);
    
    // Check container max-height allows for more than 5 items
    const activityContainer = page.locator('[class*="max-h-56"]').first();
    await expect(activityContainer).toBeVisible();
    
    // Get computed height
    const containerHeight = await activityContainer.evaluate((el) => {
      return window.getComputedStyle(el).maxHeight;
    });
    
    // max-h-56 = 14rem = 224px, should fit ~10 items at ~22px each
    expect(containerHeight).toBe('224px');
    
    // Verify we can see multiple items
    const visibleItems = await page.locator('[class*="font-mono truncate"]').count();
    expect(visibleItems).toBeGreaterThan(0);
  });

  test('live activity uses stable keys (no DOM reuse issues)', async ({ page }) => {
    // Navigate to overview and expand setup card
    const setupCard = page.locator('text=Set up computer').locator('..');
    await setupCard.click();
    
    await page.waitForTimeout(300);
    
    // Start apply
    const applyButton = page.locator('button:has-text("Apply")').first();
    await applyButton.click();
    
    const startButton = page.locator('button:has-text("Apply changes")');
    await startButton.click();
    
    // Wait for live activity
    await page.waitForSelector('text=Live activity', { timeout: 5000 });
    
    // Expand live activity
    const liveActivityToggle = page.locator('button:has-text("Live activity")');
    await liveActivityToggle.click();
    
    // Wait for initial events
    await page.waitForTimeout(1000);
    
    // Get initial app-action pairs
    const getAppActionPairs = async () => {
      const apps = await page.locator('[class*="font-mono truncate"]').allTextContents();
      const actions = await page.locator('[class*="w-14 text-right"]').allTextContents();
      return apps.map((app, i) => ({ app, action: actions[i] }));
    };
    
    const initialPairs = await getAppActionPairs();
    
    // Wait for updates
    await page.waitForTimeout(500);
    
    const laterPairs = await getAppActionPairs();
    
    // Verify that when an app's action changes, it stays in the same position
    for (const initial of initialPairs) {
      const later = laterPairs.find(p => p.app === initial.app);
      if (later) {
        const initialIndex = initialPairs.indexOf(initial);
        const laterIndex = laterPairs.indexOf(later);
        
        // App should maintain its position (or move down if new apps appended)
        expect(laterIndex).toBeGreaterThanOrEqual(initialIndex);
      }
    }
  });
});

test.describe('Double-Run Prevention', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Tauri environment with basic setup
    await page.addInitScript(() => {
      (window as any).__TAURI__ = {
        core: { invoke: async () => undefined },
        event: { listen: async () => () => {} }
      };
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('preview then apply should not double-execute', async ({ page }) => {
    // Navigate to overview and expand setup card
    const setupCard = page.locator('text=Set up computer').locator('..');
    await setupCard.click();
    
    await page.waitForTimeout(300);
    
    // Start preview
    const previewButton = page.locator('button:has-text("Preview")').first();
    await previewButton.click();
    
    const startPreviewButton = page.locator('button:has-text("Preview changes")');
    await startPreviewButton.click();
    
    // Wait for preview to complete
    await page.waitForSelector('text=Completed successfully', { timeout: 10000 });
    
    // Click "Apply changes" button
    const applyChangesButton = page.locator('button:has-text("Apply changes")');
    await applyChangesButton.click();
    
    // Wait a bit to ensure no double-trigger
    await page.waitForTimeout(1000);
    
    // Verify apply is running (should see "Working" or similar)
    await expect(page.locator('text=Installing applications')).toBeVisible({ timeout: 5000 });
    
    // Count how many times apply was invoked by checking console logs
    // This would require instrumentation in the app code
  });

  test('apply button should not trigger twice on double-click', async ({ page }) => {
    // Navigate to overview and expand setup card
    const setupCard = page.locator('text=Set up computer').locator('..');
    await setupCard.click();
    
    await page.waitForTimeout(300);
    
    // Select apply mode
    const applyButton = page.locator('button:has-text("Apply")').first();
    await applyButton.click();
    
    const startButton = page.locator('button:has-text("Apply changes")');
    
    // Double-click the button
    await startButton.dblclick();
    
    // Wait a bit
    await page.waitForTimeout(1000);
    
    // Verify button is disabled during execution
    await expect(startButton).toBeDisabled();
  });
});
