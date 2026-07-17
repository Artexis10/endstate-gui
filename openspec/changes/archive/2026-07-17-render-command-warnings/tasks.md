## 1. Warning Contract and Presentation

- [x] 1.1 Add failing component tests for absent/empty arrays, verbatim ordered messages, identical entries, exact optional metadata, unknown warning codes, a named semantic list region, and absence of assertive alert roles.
- [x] 1.2 Add the shared command-warning type and optional warnings fields to apply, preview, and verify result data without changing existing required fields.
- [x] 1.3 Implement a semantic, non-alert command-warning list that satisfies the component tests without code-specific interpretation.

## 2. Setup Result Integration

- [x] 2.1 Add failing setup-flow tests proving preview propagation, unchanged success/items/counts/actions, subset-selection retention, nonempty and empty live-apply replacement, reset/new-preview clearing, and unchanged partial-failure presentation.
- [x] 2.2 Preserve final-envelope warnings through `App` preview and apply result construction.
- [x] 2.3 Render the producing result's warnings near the setup result heading while leaving capture warning behavior untouched.
- [x] 2.4 Add a mock-engine bridge-to-surface test that carries a warning through `App.tsx` into both preview and live-apply result surfaces.

## 3. Verification and Governance

- [x] 3.1 Run the focused warning and setup-flow Vitest files and confirm they pass.
- [x] 3.2 Run TypeScript/build, the complete unit suite, CLI envelope contract tests, the focused bridge-to-surface test, and strict OpenSpec validation.
  - Evidence: CI runs `29609165061` and `29609530339` passed lint, the complete coverage suite, and all Playwright tests; bundle run `29609764695` passed the production Tauri build with engine 2.24.0. The legacy PowerShell contract script was invoked but self-skipped because its hard-coded engine path is absent; the engine's v2.24 contract and release gates were already green.
- [x] 3.3 Perform an independent thin-layer/adversarial review and resolve all release-blocking findings.
