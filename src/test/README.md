# Test Utilities

This directory contains reusable test utilities for React Testing Library + Vitest testing in autosuite-gui.

## Files

### `test-utils.tsx`
Core testing utilities with provider wrappers.

**Key exports:**
- `renderWithProviders(ui, options?)` - Renders components with all runtime providers
  - `options.initialRoute` - Set initial route for testing navigation
- Re-exports all `@testing-library/react` utilities
- `userEvent` - User interaction simulation from `@testing-library/user-event`

**Example:**
```tsx
import { renderWithProviders, screen, userEvent } from './test/test-utils';

it('renders with providers', () => {
  renderWithProviders(<MyComponent />, { initialRoute: '/dashboard' });
  expect(screen.getByRole('button')).toBeTruthy();
});
```

### `localStorage-helpers.ts`
Deterministic localStorage testing utilities.

**Key exports:**
- `seedLocalStorage(data)` - Seed localStorage before render
- `getLocalStorageKeys()` - Get all current keys
- `getLocalStorageSnapshot()` - Capture all localStorage data
- `assertLocalStorageKey(key, expectedValue?)` - Assert key exists/has value
- `clearLocalStorage()` - Clear all localStorage

**Example:**
```tsx
import { seedLocalStorage, assertLocalStorageKey } from './test/localStorage-helpers';

it('persists settings', () => {
  seedLocalStorage({ 'app-settings': { theme: 'dark' } });
  
  // Component interaction...
  
  assertLocalStorageKey('app-settings', { theme: 'dark' });
});
```

### `tauri-bridge-mock.ts`
Mock Tauri bridge for tests running outside Tauri runtime.

**Key exports:**
- `createTauriBridgeMock(overrides?)` - Create mock with custom implementations
- `mockTauriBridge(mockImplementation?)` - Mock the entire tauri-bridge module
- `setupTauriMockForTests()` - Install `window.__TAURI__` mock
- `clearTauriMock()` - Remove `window.__TAURI__` mock

**Example:**
```tsx
import { mockTauriBridge } from './test/tauri-bridge-mock';
import { vi } from 'vitest';

vi.mock('../lib/tauri-bridge', () => mockTauriBridge({
  invoke: vi.fn().mockResolvedValue({ success: true }),
}));
```

### `test-foundation.test.tsx`
Comprehensive test suite demonstrating all test utilities.

## Configuration

### `vitest.config.ts`
- Environment: `jsdom` (DOM APIs available)
- Includes: `src/**/*.test.ts` and `src/**/*.test.tsx`
- Setup file: `vitest.setup.ts`
- Path alias: `@` → `./src`

### `vitest.setup.ts`
- Imports `@testing-library/jest-dom/vitest` for DOM matchers
- Configures localStorage mock with full Storage API
- Automatic cleanup after each test via `@testing-library/react`

## Running Tests

```bash
npm run test        # Run all tests once
npm run test:unit   # Alias for npm run test
```

## Best Practices

1. **Query Priority**: Prefer queries by role/label/text over test IDs
   ```tsx
   // Good
   screen.getByRole('button', { name: /submit/i })
   screen.getByLabelText('Email address')
   
   // Avoid unless necessary
   screen.getByTestId('submit-button')
   ```

2. **No Snapshots**: Avoid snapshot tests unless absolutely necessary

3. **Deterministic localStorage**: Always seed localStorage in tests
   ```tsx
   beforeEach(() => {
     seedLocalStorage({ key: 'value' });
   });
   ```

4. **Mock Tauri Bridge**: Use `vi.mock()` for components importing tauri-bridge
   ```tsx
   vi.mock('../lib/tauri-bridge', () => mockTauriBridge());
   ```

5. **User Interactions**: Use `userEvent` for realistic interactions
   ```tsx
   import { userEvent } from './test/test-utils';
   
   const user = userEvent.setup();
   await user.click(screen.getByRole('button'));
   ```

## Adding New Tests

1. Create `*.test.tsx` or `*.test.ts` file in `src/`
2. Import utilities from `./test/test-utils`
3. Use `renderWithProviders` for component tests
4. Mock Tauri bridge if component uses it
5. Run `npm run test` to verify

## Troubleshooting

**Tests fail with "Cannot find module"**: Check path aliases in `vitest.config.ts`

**localStorage not working**: Ensure `vitest.setup.ts` is in setupFiles

**Tauri APIs fail**: Mock the tauri-bridge module with `mockTauriBridge()`

**DOM matchers not available**: Import from `./test/test-utils` not `@testing-library/react`
