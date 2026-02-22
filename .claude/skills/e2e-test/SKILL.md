---
name: e2e-test
description: Generate Playwright E2E tests following project conventions (Tauri fixture, storage isolation, helpers).
---

Generate Playwright E2E tests for the specified feature or user flow.

**Input**: Feature or flow to test. Example: `/e2e-test profile selection persistence across reload`

**Steps**

1. **Determine spec file path**: `e2e/<descriptive-name>.spec.ts`
2. **Read relevant source** to understand the UI flow being tested
3. **Generate the spec** following project conventions (see below)
4. **Verify syntax**: `npx playwright test e2e/<spec-file> --list` (lists tests without running)

**Project Conventions**

- Import test and expect from the Tauri fixture, NOT from `@playwright/test` directly:
  ```typescript
  import { test, expect } from './fixtures/tauri';
  ```
- This fixture auto-injects `__TAURI__` mock and `__ENDSTATE_MOCK_ENGINE__` into the browser context
- Use helpers from `e2e/helpers/ui-mode.ts`:
  - `forceAdvancedMode(page)` — enable sidebar navigation (call in `addInitScript` before `goto`)
  - `forceDefaultMode(page)` — Overview-centric mode
  - `goToApplyPage(page)` — navigate to and expand Apply card
  - `goToCapturePage(page)` — navigate to and expand Capture card
  - `goToVerifyPage(page)` — navigate to and expand Verify card
  - `seedProfileSettings(page)` — seed profile via `addInitScript` before `goto`
  - `seedProfilesViaHook(page)` — seed profiles after page loads via E2E hook
- Storage is isolated: `VITE_STORAGE_NS=test` prefixes all localStorage keys with `test:`
- Configure Tauri mock overrides via `test.use({ tauriMockOptions: { invoke: { ... } } })`
- App always starts on Overview page — tests must navigate explicitly

**Mock Pattern for Tauri Commands**

```typescript
test.use({
  tauriMockOptions: {
    invoke: {
      list_manifest_files: () => [
        { name: 'my-profile', path: 'C:\\profiles\\my-profile.jsonc', displayName: 'My Profile' }
      ],
      check_file_exists: () => true,
    }
  }
});
```

**Spec Template**

```typescript
import { test, expect } from './fixtures/tauri';
import { forceDefaultMode, goToApplyPage } from './helpers/ui-mode';

test.describe('Feature Name', () => {
  test.use({
    tauriMockOptions: {
      invoke: {
        list_manifest_files: () => [],
      }
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('describes expected behavior', async ({ page }) => {
    // Arrange: set up state
    // Act: user interactions
    // Assert: verify outcomes
    await expect(page.getByRole('heading', { name: /expected/i })).toBeVisible();
  });
});
```

**Known Pitfalls**
- Radix Select cannot be automated with standard click → option. Use `page.dispatchEvent()` workaround or evaluate-based selection.
- Always `waitForLoadState('networkidle')` after `goto('/')` before interacting
- Use `{ timeout: 5000 }` on assertions that depend on async rendering
- Prefer `getByRole` and `getByText` locators. Use `data-testid` locators only for structural elements (cards, panels)
