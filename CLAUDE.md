<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev              # Vite dev server (web preview, http://127.0.0.1:1420)
npm run tauri dev        # Full Tauri dev with hot reload

# Build
npm run build            # TypeScript check + Vite build
npm run tauri build      # Full Tauri production binary

# Testing
npm run test             # Vitest unit tests
npm run test:coverage    # Unit tests with v8 coverage
npm run test:e2e         # Playwright E2E tests
npm run test:contract    # CLI envelope contract tests (Node.js)
npm run test:all         # Full pipeline: openspec validate + unit + contract + e2e
cd src-tauri && cargo test  # Rust unit tests

# Run a single test file
npx vitest run src/lib/apply-utils.test.ts
# Run tests matching a name pattern
npx vitest run -t "pattern"
# Run a single Playwright spec
npx playwright test e2e/apply-modal.spec.ts

# Type checking
npx tsc --noEmit

# OpenSpec validation (also runs as pre-push hook)
npm run openspec:validate --all --strict --no-interactive
# Emergency bypass: OPENSPEC_BYPASS=1 git push

# Git hooks
npm run hooks:install    # Install lefthook pre-push hook
```

## Architecture

### Core Design: GUI is a Thin Presentation Layer

All business logic lives in the **Endstate CLI**. The GUI contains no provisioning logic. Every operation executes by spawning the CLI with `--json` and consuming structured JSON output. The GUI never fabricates or infers state.

### Data Flow

```
User Action → React Component → Tauri invoke()
  → Rust Backend (lib.rs → engine_adapter.rs)
  → Spawns: endstate <cmd> --json <args>
  → NDJSON streaming output
  → Rust parses lines, injects runId, emits via Tauri event channel (endstate://event)
  → Frontend event handler → State update → UI render
```

**Final state** always derives from the JSON envelope at command completion. Streaming text is only used for transient progress UI (live activity feed, counters).

### Frontend (src/)

- **`App.tsx`** — Main component with complex state for capabilities, report, verify, running action, lifecycle tracking
- **`components/app/overview/`** — Overview screen with dual-flow architecture (Capture/Setup flows). `useOverviewState` hook manages action status, expanded cards, running state. `FlowSelector` is the primary action hub.
- **`components/ui/`** — shadcn/ui primitives. **All interactive UI must use shadcn components** (Button, Select, Dialog, etc.) unless there's a documented exception. Native HTML elements break theming.
- **`lib/`** — Core logic: engine execution, streaming event parsing, state management, profile handling
- **`types.ts`** — Central types: `EndstateEnvelope<T>`, capability/verify/apply/capture data types

### Rust Backend (src-tauri/src/)

- **`lib.rs`** — Tauri commands (`engine_run`, `engine_cancel`, `engine_is_running`, etc.) and event emission
- **`engine_adapter.rs`** — CLI streaming adapter: spawns process, reads stdout/stderr concurrently, parses NDJSON, injects runId on all events, enforces one-run-at-a-time mutex
- **`cmd_impl.rs`** — Shared command builder. **Critical:** Windows `.cmd` PATH shims require `cmd /C` wrapping. All spawn sites MUST use `build_engine_command()` — never construct `Command::new(exe)` directly for engine invocation.

### Key Abstractions

- **`EndstateEnvelope<T>`** — Standardized CLI response: `{ schemaVersion, cliVersion, command, runId, timestampUtc, success, data, error }`
- **`EngineEvent`** — Union: LogEvent | ResultEvent | CliEnvelopeEvent
- **Event filtering by runId** — Events from previous runs must not pollute current display
- **One run at a time** — Mutex guard at Rust layer blocks concurrent CLI execution

### Path Alias

`@/*` maps to `./src/*` (configured in tsconfig.json and vite.config.ts).

### localStorage Namespacing

Keys are prefixed by runtime: `tauri:`, `web:`, or `test:` (e.g., `tauri:Endstate-gui-settings`). Playwright tests use `VITE_STORAGE_NS=test` for isolation.

## Authority Documents

These govern AI behavior in this repo, in precedence order:

1. `docs/ai/AI_CONTRACT.md` — AI behavior contract (highest authority)
2. `docs/ai/PROJECT_RULES.md` — Operational policy
3. `CLAUDE.md` — Architecture context, commands, landmines (this file, auto-loaded by Claude Code)
4. `openspec/specs/` — Invariants and behavior specifications (lazy-loaded on demand)

### Key Rules from These Documents

- **Smallest change** that satisfies acceptance criteria. No unrelated refactors, formatting sweeps, or dependency bumps.
- **Preserve public APIs** and integration contracts unless explicitly changing them.
- **Run only minimum targeted verification** — not full test suites unless requested.
- **Protected files** (require explicit instruction to modify): `docs/ai/*`, `docs/ux-guardrails.md`, `docs/ux-principles.md`, `src/engine-bridge.ts`, `src-tauri/src/engine_adapter.rs`

## Testing Conventions

- Unit tests are co-located: `*.test.ts` / `*.test.tsx` next to source files
- E2E tests: `e2e/*.spec.ts` (Playwright, chromium)
- Test utilities in `src/test/`: `test-utils.tsx` (renderWithProviders), `localStorage-helpers.ts`, `tauri-bridge-mock.ts`
- Query priority: `getByRole` → `getByLabelText` → `getByText` → avoid `getByTestId`. No snapshot tests.
- Coverage thresholds enforced in CI: 70% lines/statements, 60% branches, 55% functions
- `vitest.setup.ts` mocks framer-motion and localStorage

## Critical Landmines

- **Preview vs execution semantics** — Dry-run output must NEVER be presented as execution results
- **Phase transitions within single spawn** — Apply + Verify run in one CLI call. Activity list must NOT reset between phases.
- **Status semantic rules** — `verify` + `failed` + `missing` → MISSING (warn), not FAILED. `apply` + `skipped` + `already_installed` → "Already present" (success). See `docs/ux-language.md` for full mapping.
- **Cross-repo contract coupling** — Status/phase semantics are coupled between GUI (`docs/ux-language.md`) and engine (`../endstate/docs/event-contract.md`). Changes must update both.
- **Stale engine binary mitigated by predev auto-rebuild** — The `predev` script (`scripts/rebuild-engine.cjs`) rebuilds the Go engine binary on every `npm run dev` / `tauri dev`. If the Go toolchain is unavailable, it falls back to the existing binary with a warning. Set `SKIP_ENGINE_BUILD=1` to skip for rapid frontend iteration. Manual testing or Tauri dev without `npm run` still requires a manual rebuild.
- **Config-only app display names from module catalog** — Config-only apps (synthesized from pathExists matchers) get their display names from the engine's module catalog `displayName` field. If missing, the app ID is used as-is.
- **Scan cooldown** — The "Scan again" button has a 5-second debounce to prevent winget database lock contention from rapid successive captures.
- **Tidewave Windows path bug** — `patches/tidewave+0.6.0.patch` fixes `eval_worker.js` where `import()` with bare Windows paths (`C:\...` or `C:/...`) causes `ERR_UNSUPPORTED_ESM_URL_SCHEME` because Node's ESM loader interprets `C:` as a URL protocol. The upstream code has no Windows path handling at all. The patch adds two layers: (1) a `module.register()` ESM resolve hook that intercepts **all** dynamic imports (including `import(path.join(cwd, ...))` where the path is computed at runtime), converting Windows paths to `file:///` URLs; (2) a regex-based `fixWindowsImportPaths()` that rewrites string-literal paths in eval code text as a belt-and-suspenders fallback. **When upgrading tidewave**, check if the upstream `eval_worker.js` has Windows path handling; if so, remove the patch. If not, regenerate: copy the patch's `import { register }` block and `fixWindowsImportPaths` function into `node_modules/tidewave/dist/evaluation/eval_worker.js`, then run `npx patch-package tidewave`.

## Patches

- **`patches/tidewave+0.6.0.patch`** — Windows ESM path fix for `eval_worker.js` (used by both Vite plugin and Tidewave CLI). Applied automatically via `postinstall: "patch-package"`. See Critical Landmines above.

## OpenSpec

Significant changes must be represented as OpenSpec changes. Level 2 enforcement: pre-push hook blocks invalid specs. Specs live in `openspec/specs/`, changes in `openspec/changes/`. Emergency bypass: `OPENSPEC_BYPASS=1 git push`.
