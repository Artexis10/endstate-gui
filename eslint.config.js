// Flat ESLint config — intentionally minimal.
//
// The ONLY rule enabled is `react/forbid-elements`, which enforces the
// project invariant that interactive UI must use the shadcn primitives in
// `src/components/ui/` rather than native HTML controls. Native form
// elements don't pick up the theme — see CLAUDE.md ("All interactive UI
// must use shadcn components ... Native HTML elements break theming").
//
// We deliberately do NOT enable the broader recommended rule sets: this
// config exists to guard one invariant, not to retrofit a full lint pass
// onto the codebase. (That's also why native <button> — used in ~18 places
// — is not forbidden yet; tightening that is a separate, larger cleanup.)
//
// The shadcn primitives themselves wrap native elements by design, so
// `src/components/ui/**` is exempted. Genuine one-off exceptions (e.g. a
// hidden <input type="file"> — there is no shadcn file-picker primitive)
// use an inline `// eslint-disable-next-line react/forbid-elements` with a
// justification at the call site.

import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const NATIVE_CONTROL_HINT =
  'Native form elements break theming. For a genuine exception, add ' +
  '`// eslint-disable-next-line react/forbid-elements` with a justification.';

export default [
  {
    ignores: ['dist/**', 'src-tauri/**', 'src/components/ui/**'],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    linterOptions: {
      // This config guards a single invariant (forbid-elements); it does not
      // police disable-directive hygiene. Keeping this 'off' also stops the
      // codebase's pre-existing `react-hooks/*` and `@typescript-eslint/*`
      // disable directives (fossils of an earlier lint setup) from being
      // flagged as "unused" now that those rules are registered-but-off.
      reportUnusedDisableDirectives: 'off',
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      react,
      // `react-hooks` is enabled for `rules-of-hooks` ONLY (see rules below) —
      // it catches the recurring "hook called conditionally / after an early
      // return" bug class. `exhaustive-deps` stays OFF (the codebase has
      // intentional dependency-array suppressions). `@typescript-eslint` is
      // registered with no rules enabled. Both plugins must be present so the
      // codebase's existing `eslint-disable react-hooks/exhaustive-deps` /
      // `@typescript-eslint/no-unused-vars` directives resolve to real rule
      // definitions instead of erroring as unknown rules.
      'react-hooks': reactHooks,
      '@typescript-eslint': tseslint.plugin,
    },
    settings: { react: { version: 'detect' } },
    rules: {
      // Structural hook safety — hooks must not be called conditionally or
      // after an early return. Zero current violations; this keeps it that way.
      'react-hooks/rules-of-hooks': 'error',
      'react/forbid-elements': [
        'error',
        {
          forbid: [
            {
              element: 'select',
              message: `Use the shadcn <Select> (@/components/ui/select). ${NATIVE_CONTROL_HINT}`,
            },
            {
              element: 'input',
              message: `Use the shadcn <Input>/<Checkbox>/<RadioGroup>/<Switch> (@/components/ui/*). ${NATIVE_CONTROL_HINT}`,
            },
            {
              element: 'textarea',
              message: `Use the shadcn <Textarea> (@/components/ui/textarea). ${NATIVE_CONTROL_HINT}`,
            },
          ],
        },
      ],
    },
  },
];
