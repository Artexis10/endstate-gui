# Tauri Fixture Usage Guide

## Overview

The `tauri.ts` fixture provides context-level `__TAURI__` and `__ENDSTATE_MOCK_ENGINE__` mocks for E2E tests that require these APIs to be available **before** page creation.

## When to Use the Fixture

Use `import { test, expect } from './fixtures/tauri'` when:

- **Boot integrity tests** – Verifying the app initializes correctly without hanging
- **Navigation smoke tests** – Testing basic page navigation with default engine behavior
- **Persistence tests** – Testing localStorage/state persistence across reloads
- **Plugin-store initialization** – When Tauri APIs must be available during module initialization

### Example

```typescript
import { test, expect } from './fixtures/tauri';
import { forceAdvancedMode } from './helpers/ui-mode';

test.describe('Navigation Smoke', () => {
  test.use({
    tauriMockOptions: {
      invoke: {
        list_manifest_files: () => [],
      }
    }
  });

  test.beforeEach(async ({ page }) => {
    await forceAdvancedMode(page);
    await page.goto('/');
  });

  test('navigates without crashing', async ({ page }) => {
    // Test navigation...
  });
});
```

## When to Use Page-Level Mocks

Use `installTauriMock(page, ...)` + custom `__ENDSTATE_MOCK_ENGINE__` when:

- **Stateful engine behavior** – Engine needs to track call counts, fail-then-succeed patterns
- **Custom streaming logic** – Complex `onEvent` behavior or timing requirements
- **Per-test engine variation** – Different engine configs within the same describe block
- **App-installed E2E hooks** – Tests depend on `__endstate_e2e_*` hooks (e.g., `__endstate_e2e_showToast`)

### Example

```typescript
import { test, expect } from '@playwright/test';
import { installTauriMock } from './helpers/tauri-mock';

test.describe('Error Retry Flow', () => {
  test.beforeEach(async ({ page }) => {
    await installTauriMock(page, {
      invoke: {
        list_manifest_files: () => ['profile.jsonc'],
      }
    });

    await page.addInitScript(() => {
      (window as any).__ENDSTATE_MOCK_ENGINE__ = {
        runEndstateStreaming: async (settings, command, args, onEvent) => {
          // Custom stateful behavior
          const callNum = (window as any).__callCount || 0;
          (window as any).__callCount = callNum + 1;
          
          if (callNum === 0) {
            return { exitCode: 1, envelope: { success: false } };
          }
          return { exitCode: 0, envelope: { success: true } };
        }
      };
    });

    await page.goto('/');
  });

  test('retries after failure', async ({ page }) => {
    // Test retry logic...
  });
});
```

## Fixture Defaults

The fixture provides:

- **`__TAURI__` mock** with default invoke handlers (via `installTauriMockOnContext`)
- **`__ENDSTATE_MOCK_ENGINE__`** with minimal capabilities response:
  ```javascript
  {
    runEndstateStreaming: async (settings, command, args, onEvent) => {
      if (command === 'capabilities') {
        return {
          exitCode: 0,
          envelope: {
            success: true,
            data: {
              version: '1.0.0',
              drivers: ['winget', 'scoop'],
              features: []
            }
          }
        };
      }
      return { exitCode: 0, envelope: { success: true, data: {} } };
    }
  }
  ```

## Migration Status

**Migrated to fixture:**
- `navigation-smoke.spec.ts`
- `web-only.spec.ts`
- `persistence-reload.spec.ts`

**Remaining page-level (by design):**
- All specs with custom engine behavior (12 specs)
- All specs using app-installed E2E hooks (8 specs)

The fixture has reached its natural boundary. Further migration would require either fixture extension (out of scope) or app code changes (forbidden).
