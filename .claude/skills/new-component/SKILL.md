---
name: new-component
description: Scaffold a new React component with co-located test, shadcn/ui primitives, and barrel export registration.
---

Scaffold a new React component following project conventions.

**Input**: Component name and location. Examples:
- `/new-component StatusBadge in components/app` → `src/components/app/status-badge.tsx`
- `/new-component LiveCounter in components/app/overview/components` → in the overview subdirectory

**Steps**

1. **Determine file paths**
   - Component: `src/<location>/<kebab-case-name>.tsx`
   - Test: `src/<location>/<kebab-case-name>.test.tsx`
   - Component names are PascalCase exports, file names are kebab-case

2. **Create the component file** with:
   - Typed props interface (`<Name>Props`)
   - shadcn/ui imports for any interactive elements (Button, Card, Select, Dialog, etc.)
   - `@/` path alias for all project imports
   - Icons from `lucide-react` if needed
   - `framer-motion` for animations if needed

3. **Create the co-located test file** with:
   - Import from `@/test/test-utils` (not `@testing-library/react` directly)
   - Basic render test + one behavioral test
   - Query by role, not by test ID

4. **Register in barrel export** if one exists in the target directory's `index.ts`

5. **Verify** — run the test: `npx vitest run <test-file>`

**Component Template**

```tsx
import { ComponentProp } from '@/components/ui/button'; // shadcn as needed

interface MyComponentProps {
  // typed props
}

export function MyComponent({ ...props }: MyComponentProps) {
  return (
    // JSX using shadcn/ui primitives for interactive elements
  );
}
```

**Mandatory Rules**
- All interactive elements (buttons, inputs, selects, toggles, dialogs) MUST use shadcn/ui components from `@/components/ui/`
- Native HTML `<button>`, `<select>`, `<input>` are only allowed for non-interactive semantic markup or documented exceptions
- Use Tailwind classes for styling — no inline styles, no CSS modules
- Use the project's extended color tokens: `success`, `warning`, `danger`, `panel`, `muted` (defined in tailwind.config.js)
