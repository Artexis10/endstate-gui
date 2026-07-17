## 1. Warning Contract and Presentation

- [ ] 1.1 Add failing component tests for absent/empty arrays, verbatim ordered messages, identical entries, exact optional metadata, unknown warning codes, a named semantic list region, and absence of assertive alert roles.
- [ ] 1.2 Add the shared command-warning type and optional warnings fields to apply, preview, and verify result data without changing existing required fields.
- [ ] 1.3 Implement a semantic, non-alert command-warning list that satisfies the component tests without code-specific interpretation.

## 2. Setup Result Integration

- [ ] 2.1 Add failing setup-flow tests proving preview propagation, unchanged success/items/counts/actions, subset-selection retention, nonempty and empty live-apply replacement, reset/new-preview clearing, and unchanged partial-failure presentation.
- [ ] 2.2 Preserve final-envelope warnings through `App` preview and apply result construction.
- [ ] 2.3 Render the producing result's warnings near the setup result heading while leaving capture warning behavior untouched.
- [ ] 2.4 Add a mock-engine bridge-to-surface test that carries a warning through `App.tsx` into both preview and live-apply result surfaces.

## 3. Verification and Governance

- [ ] 3.1 Run the focused warning and setup-flow Vitest files and confirm they pass.
- [ ] 3.2 Run TypeScript/build, the complete unit suite, CLI envelope contract tests, the focused bridge-to-surface test, and strict OpenSpec validation.
- [ ] 3.3 Perform an independent thin-layer/adversarial review and resolve all release-blocking findings.
