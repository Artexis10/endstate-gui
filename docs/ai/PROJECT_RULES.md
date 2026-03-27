# Project Rules: endstate-gui

## 1. Scope and Authority

This document is authoritative for repository operational policy.

**Authority hierarchy:**
1. `docs/ai/AI_CONTRACT.md` — AI behavior contract (highest authority)
2. `docs/ai/PROJECT_RULES.md` — operational policy (this file)
3. `CLAUDE.md` — architecture context, commands, landmines (auto-loaded by Claude Code)
4. `openspec/specs/` — invariants and behavior specifications (lazy-loaded on demand)

---

## 2. Protected Areas and Change Boundaries

### Protected (require explicit instruction)

- `docs/ai/*` — AI governance files
- `docs/ux-guardrails.md` — UX contract
- `docs/ux-principles.md` — UX contract
- `docs/profile-contract.md` — profile contract
- `src/cli-bridge.ts` — canonical CLI invocation layer
- `src/engine-bridge.ts` — engine abstraction layer
- `src-tauri/src/engine_adapter.rs` — Rust CLI adapter

### Safe to modify without architectural review

- `src/components/` — UI components (presentation only)
- `src/lib/` — utilities (except bridge files)
- `e2e/` — E2E tests
- `src/**/*.test.ts`, `src/**/*.test.tsx` — unit tests

---

## 3. Environment and Config Contract

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `VITE_STORAGE_NS` | localStorage namespace override (e.g., "test" for Playwright) |
| `TAURI_PLATFORM` | Auto-set by Tauri runtime; used for runtime detection |

### Runtime Detection

1. **Tauri runtime:** Detected via `import.meta.env.TAURI_PLATFORM`
2. **Web runtime:** Default when not in Tauri
3. **Test runtime:** When `VITE_STORAGE_NS=test`

---

## 4. Build / Dev / Runtime Contract

### Commands

| Command | Purpose |
|---------|---------|
| `npm install` | Install dependencies |
| `npm run dev` | Vite dev server (web preview) |
| `npm run tauri dev` | Full Tauri dev with hot reload |
| `npm run build` | TypeScript + Vite production build |
| `npm run tauri build` | Full Tauri production build |
| `npm run tauri icon app-icon.png` | Regenerate icons |

### CLI Path

- **Development:** `endstate` resolved from system PATH
- **Production:** Bundled binary at known path

---

## 5. State / Storage / Artifacts Contract

### localStorage Namespace Isolation

Keys are prefixed with namespace: `{namespace}:{key}`

| Runtime | Namespace | Example Key |
|---------|-----------|-------------|
| Tauri | `tauri` | `tauri:Endstate-gui-settings` |
| Web | `web` | `web:Endstate-gui-settings` |
| Test | `test` | `test:Endstate-gui-settings` |

**Rules:**
- Tauri runtime NEVER reads from legacy un-namespaced keys
- Web/Test falls back to legacy keys and migrates them
- Reset Settings clears ALL namespaces plus legacy keys

### Gitignored Artifacts

- `test-results/` — Playwright artifacts
- `node_modules/`
- `dist/`
- `src-tauri/target/`

**Never commit runtime artifacts.**

---

## 6. Testing and Verification Contract

### Test Framework

| Type | Framework | Command |
|------|-----------|---------|
| Unit | Vitest + jsdom | `npm run test` |
| Unit + coverage | Vitest | `npm run test:coverage` |
| E2E | Playwright | `npm run test:e2e` |
| Contract | Node.js | `npm run test:contract` |
| Rust | Cargo | `cd src-tauri && cargo test` |

### Coverage Thresholds

| Metric | Threshold |
|--------|-----------|
| Statements | 70% |
| Lines | 70% |
| Branches | 60% |
| Functions | 55% |

Thresholds increase as coverage improves. Never decrease.

### Test Isolation Rules

- GUI tests MUST NOT install software
- GUI tests MUST NOT modify the host system
- GUI tests MUST NOT depend on machine-specific state
- All integration tests MUST use mocked CLI responses
- Playwright tests set `VITE_STORAGE_NS=test` for storage isolation

### Test Utilities Location

All reusable test utilities live in `src/test/`:
- `test-utils.tsx` — `renderWithProviders` and RTL re-exports
- `localStorage-helpers.ts` — deterministic localStorage testing
- `tauri-bridge-mock.ts` — mock Tauri bridge for non-Tauri environments

### Query Priority

1. **Prefer:** `getByRole`, `getByLabelText`, `getByText`
2. **Avoid:** `getByTestId` (use only when semantic queries fail)
3. **Never:** Snapshot tests

### Regression Prevention

Any UI/UX bug that reaches production MUST result in a new test.

---

## 7. Contracts and CLI Interface Rules

### CLI JSON Envelope Contract

- All CLI calls MUST include `--json`
- Capture stdout, stderr, and exit code separately
- Non-zero exit codes are failures, even if JSON is returned
- If stdout cannot be parsed as JSON, the run is failed

### Streaming Output Rules

- Streaming text MAY be parsed for transient progress only
- Final state MUST derive from JSON envelope
- stderr may be displayed as diagnostics but MUST NOT affect state

### Cross-Repo Contract References

| Document | Location |
|----------|----------|
| UX Language | `docs/ux-language.md` |
| Engine Event Contract | `../endstate/docs/event-contract.md` |
| Profile Contract | `docs/profile-contract.md` |

---

## 8. Tooling and Git Policy

### Git Hooks

Do not use `--no-verify` unless explicitly instructed by user.

### OpenSpec Enforcement

This repository uses **Level 2 enforcement** (workflow gate):
- Pre-push hook validates OpenSpec via lefthook
- Install hooks: `npm run hooks:install`
- Validate manually: `npm run openspec:validate`
- Bypass (emergency only): `OPENSPEC_BYPASS=1 git push`

See `docs/runbooks/OPENSPEC_ENFORCEMENT.md` for details.

### File Write Fallback

If normal file writes fail, use PowerShell `Set-Content` with leaf-path guard:
```powershell
Set-Content -Path $path -Value $content -Force
```

Verify writes completed before claiming success.

---

## 9. References

| Document | Purpose |
|----------|---------|
| `docs/ai/AI_CONTRACT.md` | AI behavior contract |
| `docs/ux-guardrails.md` | UX forbidden behaviors |
| `docs/ux-principles.md` | UX design principles |
| `docs/profile-contract.md` | Profile validation contract |
