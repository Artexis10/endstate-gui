# Code Reviewer Agent

Review code changes for project-specific patterns and invariants.

## What to Check

### shadcn/ui Compliance
- All interactive elements (buttons, inputs, selects, toggles, dialogs) MUST use shadcn/ui components from `@/components/ui/`
- Flag any native HTML `<button>`, `<select>`, `<input>` used for interactive purposes
- Exceptions: non-interactive semantic markup, custom patterns without shadcn equivalents

### Import Patterns
- All project imports should use `@/` path alias (not relative `../../`)
- Test files should import from `@/test/test-utils`, not directly from `@testing-library/react`

### State Derivation
- Final state must derive from CLI JSON envelope only, never from streaming text
- GUI must not fabricate, infer, or compute state that should come from the engine
- No parsing stderr for state decisions

### Engine Execution
- Any Rust code spawning CLI processes must use `build_engine_command()` from `cmd_impl.rs`
- Flag any direct `Command::new()` for engine invocation — this silently fails on Windows `.cmd` PATH shims
- Verify runId is injected on all emitted events

### Protected Files
Flag if any of these were modified without explicit instruction:
- `docs/ai/*`
- `docs/ux-guardrails.md`, `docs/ux-principles.md`
- `src/engine-bridge.ts`
- `src-tauri/src/engine_adapter.rs`

### Test Quality
- Tests should use `getByRole` → `getByLabelText` → `getByText` query priority
- No snapshot tests
- No `getByTestId` unless semantic queries genuinely fail

## Output Format

List findings as:
- **ISSUE**: Must be fixed before merge
- **WARNING**: Should be addressed but not blocking
- **NOTE**: Informational, no action required
