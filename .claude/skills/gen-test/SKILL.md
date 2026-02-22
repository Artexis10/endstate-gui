---
name: gen-test
description: Generate unit tests following project conventions. Use when the user asks to create, generate, or write tests for a file or component.
---

Generate unit tests for the specified file or component.

**Input**: A file path, component name, or utility function to test. If omitted, infer from conversation context.

**Steps**

1. **Read the source file** to understand exports, types, and behavior
2. **Check for an existing test file** co-located next to the source (e.g., `foo.ts` → `foo.test.ts`)
   - If it exists, read it and add new tests rather than replacing
3. **Generate tests** following project conventions (see below)
4. **Run the new tests** to verify they pass: `npx vitest run <test-file>`

**Project Conventions**

- Test files are co-located: `src/lib/foo.ts` → `src/lib/foo.test.ts`, `src/components/app/bar.tsx` → `src/components/app/bar.test.tsx`
- Framework: Vitest + React Testing Library (jsdom environment)
- Import from `vitest`: `describe`, `it`, `expect`, `vi`, `beforeEach`, `afterEach`
- For React components, import `render`, `screen`, `fireEvent`, `within` from `@/test/test-utils` (NOT directly from `@testing-library/react`)
- Query priority: `getByRole` → `getByLabelText` → `getByText`. Avoid `getByTestId` unless semantic queries fail. Never use snapshots.
- Use `@/` path alias for imports (maps to `./src/`)
- framer-motion is auto-mocked in `vitest.setup.ts` — no special handling needed
- localStorage is auto-mocked — use helpers from `@/test/localStorage-helpers` if needed
- For Tauri bridge mocking, use `@/test/tauri-bridge-mock`
- Group related tests in `describe` blocks
- Test names should describe behavior, not implementation

**Example Structure**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@/test/test-utils';
import { MyComponent } from './my-component';

describe('MyComponent', () => {
  it('renders the primary action button', () => {
    render(<MyComponent />);
    expect(screen.getByRole('button', { name: /action/i })).toBeInTheDocument();
  });

  it('calls onSubmit when clicked', async () => {
    const onSubmit = vi.fn();
    render(<MyComponent onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    expect(onSubmit).toHaveBeenCalledOnce();
  });
});
```

**Guardrails**
- Keep tests focused on behavior, not implementation details
- Don't mock what you don't have to
- Don't add tests for trivial pass-through props
- If the source file uses shadcn/ui components, query by role (they use Radix primitives with proper ARIA)
