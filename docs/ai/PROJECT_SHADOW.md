# Project Shadow: Endstate GUI

## 1. Identity

**Project Name:** Endstate GUI  
**Purpose:** Desktop application providing a graphical interface for the Endstate machine provisioning and hydration system.  
**Primary Languages:** TypeScript (frontend), Rust (backend/Tauri)  
**Repository Type:** Tauri desktop application (React + Vite frontend, Rust backend)

---

## 2. Architecture Overview

### High-Level Structure

```
endstate-gui/
├── src/                    # React frontend (TypeScript)
│   ├── components/         # UI components
│   │   ├── app/            # Application-specific components
│   │   ├── layout/         # Layout components
│   │   └── ui/             # shadcn/ui primitives
│   ├── lib/                # Utilities, state management, engine integration
│   └── test/               # Test utilities and mocks
├── src-tauri/              # Rust backend (Tauri)
│   └── src/
│       ├── lib.rs          # Tauri commands and plugin registration
│       ├── main.rs         # Entry point
│       └── engine_adapter.rs  # CLI streaming adapter
├── e2e/                    # Playwright end-to-end tests
├── tests/                  # Contract tests
└── docs/                   # Documentation and contracts
```

### Entry Points

- **Frontend:** `src/main.tsx` → `src/App.tsx`
- **Backend:** `src-tauri/src/main.rs` → `src-tauri/src/lib.rs`
- **Engine Adapter:** `src-tauri/src/engine_adapter.rs`

### Key Directories

- `src/components/app/` — Application screens, modals, and workflows
- `src/lib/` — Core logic: engine execution, streaming events, state management
- `src-tauri/src/` — Tauri commands, CLI process management, event streaming

---

## 3. Core Abstractions

### Central Types (`src/types.ts`)

- **`EndstateEnvelope<T>`** — Standard CLI response wrapper with schema version, command, success, data, error
- **`EndstateCapabilitiesData`** — CLI capabilities handshake response
- **`EndstateVerifyData`** — Verify command results
- **`EndstateApplyData`** — Apply command results
- **`EndstateCaptureData`** — Capture command results

### Engine Bridge (`src/engine-bridge.ts`)

- **`EngineEvent`** — Union type for all CLI events (LogEvent, ResultEvent, CliEnvelopeEvent)
- **`subscribeToEvents()`** — Subscribe to Tauri event channel
- **`engineRun()`** — Start CLI execution with streaming output
- **`engineCancel()`** — Cancel running CLI process

### Streaming Events (`src/lib/streaming-events.ts`)

- Parses NDJSON streaming output from CLI
- Handles progress, phase, and result events

### Data Flow

1. User action triggers frontend command
2. Frontend calls Tauri command via `invoke()`
3. Rust backend spawns `endstate` CLI process
4. CLI output streamed as NDJSON to frontend via Tauri events
5. Frontend updates UI based on event types

### Naming Conventions

- React components: PascalCase (`ApplyResultModal.tsx`)
- Utilities: kebab-case files, camelCase exports (`streaming-events.ts`)
- Tests: `*.test.ts` / `*.test.tsx` co-located with source
- E2E tests: `*.spec.ts` in `e2e/` directory

---

## 4. Invariants

1. **GUI is a thin presentation layer.** All business logic resides in the Endstate CLI. The GUI contains no provisioning logic and makes no assumptions about CLI internals.

2. **CLI is the single source of truth.** All operations execute via CLI invocation. GUI never fabricates or infers state.

3. **JSON is the contract.** The GUI MUST invoke the CLI with `--json` at all times and rely exclusively on structured JSON output. Human-readable CLI text MUST NOT be parsed for state.

4. **Final state derives from JSON envelope only.** Streaming CLI text MAY be parsed for transient UI progress (live activity feed, progress indicators), but final success/failure and app statuses MUST be derived exclusively from the JSON envelope at command completion.

5. **One run at a time.** Only one CLI process can be active. Concurrent execution is blocked at the Rust layer (mutex guard).

6. **Schema version compatibility required.** GUI refuses execution if CLI schema version is incompatible.

7. **All user-relevant state must be visible.** No hidden state in AppData or invisible databases.

8. **Configuration restore is OFF by default.** Install-only is the default behavior.

9. **Secrets and credentials are never handled.** No browser profiles, tokens, or license blobs.

10. **Errors originate from engine.** All errors MUST originate from the engine JSON envelope. The GUI displays engine error messages verbatim and MUST NOT invent error categories not present in the engine response.

### Responsibility Boundaries

**The GUI MAY:**
- Render progress and results
- Visualize drift and verification outcomes
- Provide UX affordances (confirmations, warnings, summaries)
- Export JSON reports produced by the engine

**The GUI MUST NOT:**
- Reimplement install, verify, or planning logic
- Guess missing parameters or auto-correct manifests
- Retry destructive actions automatically
- Mutate manifests or engine state without explicit user action

---

## 5. Contracts and Boundaries

### Public Contracts

- **CLI JSON Envelope:** All CLI commands with `--json` return standardized envelope with `schemaVersion`, `cliVersion`, `command`, `success`, `data`, `error`
- **Event Channel:** `endstate://event` for streaming CLI output to frontend
- **Profile Contract:** Profiles are visible folders in `Documents/Endstate/Profiles`

### Tauri Commands (Rust → Frontend)

- `engine_run` — Start CLI process
- `engine_cancel` — Cancel running process
- `engine_is_running` — Check if process active
- `engine_get_run_id` — Get current run ID
- `validate_profile` — Validate profile manifest

### Stable vs Internal

- **Stable:** CLI envelope format, event channel name, Tauri command signatures
- **Internal:** Component implementation details, utility function signatures

---

## 6. Landmines

1. **Preview vs Execution semantics must never be conflated.** Dry-run output must never be presented as execution results. "Would install" ≠ "installed".

2. **Status language must be unambiguous.** Each status maps to exactly one semantic meaning. Never overload "skipped" to mean multiple things.

3. **Event filtering by runId is critical.** Events from previous runs must not pollute current run display.

4. **Fallback results can mask CLI failures.** If CLI exits without terminal result, adapter emits fallback. Ensure fallback handling is explicit.

5. **File write failures in Tauri.** Normal file tools may fail; PowerShell `Set-Content` is the documented fallback.

6. **shadcn/ui component requirement.** All interactive UI must use shadcn components unless documented exception exists. Native HTML elements break theming.

7. **Coverage thresholds enforced.** Vitest coverage thresholds will fail CI if not met.

8. **Streaming output semantic distinction.** When parsing streaming output:
   - `skipped` + `already_installed` reason → "Already present" (success color, PRESENT label)
   - `skipped` + other reasons (filtered, policy) → "Skipped" (warning color, SKIPPED label)
   This ensures live activity feed matches final JSON envelope semantics.

9. **Phase transitions within single spawn.** The engine performs Apply followed by Verify within a single spawn. The GUI must detect phase transitions via streaming markers. Activity list MUST NOT reset, scroll jump, or reinitialize between phases.

10. **Status/phase semantic rules (must not drift):**
    - `verify` + `status=failed` + `reason=missing` → UI displays **MISSING** (warn), not FAILED (error)
    - `apply` + `status=skipped` + `reason=user_denied` → UI displays **CANCELLED** (warn), not FAILED (error)
    - `verify` + `status=present` → UI displays **CONFIRMED**, not "Already present"
    - **INSTALLED** vs **CONFIRMED**: Installed = installed this run; Confirmed = verified present
    - `user_denied` detection is heuristic and unreliable (no standardized winget exit code)

11. **Windows .cmd PATH resolution.** Rust's `std::process::Command` only resolves `.exe` files on Windows PATH. The `endstate.cmd` shim requires `cmd /C` wrapping. All process spawn sites MUST use the shared `build_engine_command()` helper in `cmd_impl.rs`. Never construct `Command::new(exe)` directly for engine invocation — new spawn sites will silently fail in PATH mode.

12. **Tauri `\\?\` extended path prefix.** Tauri's `resource_dir()` returns paths with the `\\?\` extended-length prefix on Windows. PowerShell 5.1's `Split-Path` cannot parse drive letters from these paths, causing `$PSScriptRoot`-derived variables to be null. All paths returned to the frontend or passed to PowerShell must be stripped via `strip_extended_path_prefix()` in `cmd_impl.rs`. Two code paths are affected: (a) `get_bundled_engine_path` in `lib.rs` (non-streaming exec), (b) `build_bundled_engine_command` in `cmd_impl.rs` (streaming exec via engine_adapter).

13. **Cross-repo contract coupling.** Status/phase semantics are coupled between GUI and engine:
    - UI semantics: `docs/ux-language.md`
    - Engine event schema: `../endstate/docs/event-contract.md`
    Changes to status/phase behavior MUST update both repos.

14. **Config module data comes from bundle metadata, not the dry-run envelope.** The engine's `--dry-run` envelope does not include `configModuleMap` or `restoreModulesAvailable`. Config module info is read from the engine-produced `metadata.json` inside the bundle directory (`readBundleMetadata()` in `App.tsx`). Settings count comes from `configModulesIncluded`, and per-app gear icons use fuzzy matching between config module names and manifest app IDs. If the engine later adds these fields to the envelope, the GUI will prefer them automatically.

15. **Bundle profile naming vs manifest filename.** Extracted zip bundles contain a generic `manifest.jsonc`. Profile discovery must use the **parent directory name** (e.g., `hugo-desktop`) as the profile ID, not the manifest filename. See `file-discovery.ts` `isNestedInSubdir` logic.

---

## 7. Non-Goals

1. **Not a data migration tool.** Endstate does not migrate personal data, browser profiles, or credentials.

2. **Not a personalization sync tool.** Endstate provisions machines; it does not sync preferences across devices.

3. **No automatic configuration restore.** Config restore requires explicit user opt-in per app.

4. **No hidden internal state.** Profiles are never stored in AppData or invisible locations.

5. **No GUI-only features.** Everything the GUI does must be reproducible via CLI.

6. **No secrets handling.** Browser profiles, auth tokens, password managers, and license blobs are intentionally unsupported with no override.

7. **GUI is not a configuration management engine.** That responsibility belongs to Endstate CLI.

8. **GUI is not a policy engine.** Policy decisions are made by the engine.

9. **GUI is not responsible for idempotency or safety guarantees.** Those guarantees belong exclusively to Endstate (engine).

### Guiding Principle

> The GUI is replaceable. The engine is not.

When in doubt, push logic down into the engine.

---

## 8. Testing Strategy

### Test Organization

- **Unit tests:** `src/**/*.test.ts`, `src/**/*.test.tsx` — co-located with source
- **E2E tests:** `e2e/*.spec.ts` — Playwright browser tests
- **Contract tests:** `tests/contract.test.js`
- **Rust tests:** `src-tauri/src/` — inline `#[cfg(test)]` modules

### What Must Be Tested

- All streaming event parsing and type guards
- Apply/Verify result modal state transitions
- Engine bridge command invocation
- Profile validation and discovery
- Rust engine adapter parsing and runId injection

### Commands

```bash
npm run test           # Vitest unit tests
npm run test:coverage  # Unit tests with coverage
npm run test:e2e       # Playwright E2E tests
npm run test:contract  # Contract tests
cd src-tauri && cargo test  # Rust unit tests
```

### Coverage Thresholds

- Lines: 70%
- Functions: 55%
- Branches: 60%
- Statements: 70%

---

## 9. Development Workflow

### Prerequisites

- Node.js v18+
- Rust via rustup
- Microsoft Visual C++ Build Tools (Windows)

### Setup

```bash
npm install
```

### Development

```bash
npm run tauri dev    # Start Tauri dev server with hot reload
npm run dev          # Vite dev server only (web preview)
```

### Build

```bash
npm run build        # TypeScript + Vite build
npm run tauri build  # Full Tauri production build
```

### Icon Regeneration

```bash
npm run tauri icon app-icon.png
```

### Environment Requirements

- `endstate` CLI must be on PATH for development mode
- Production builds bundle pinned CLI binary

---

## 10. Authority Model

### Decision Ownership

- **Architecture:** Human maintainer is final decision-maker
- **UX Contracts:** Defined in `docs/ux-guardrails.md` and `docs/ux-principles.md`
- **CLI Contract:** Owned by Endstate engine repository

### Review Process

- AI proposes; human disposes
- UX changes require guardrail checklist review
- Shadow-level changes require PROJECT_SHADOW.md update proposal

### Escalation

- Unclear intent → ask, do not assume
- Contract conflicts -> prefer repository code, propose Shadow update
- UX guardrail violations → redesign required

---

## 11. Shadow Update Policy

If repository code diverges from this Shadow, **code wins**.

When divergence is detected:
1. Do not silently drift - propose a Shadow update via pull request
2. The update must describe the minimal change to reconcile Shadow with code
3. Human maintainer approves or rejects the update
4. Until approved, treat code as authoritative for the divergent area

This ensures the Shadow remains accurate without blocking development.

> **Note:** The historical "Delta Shadow" mechanism (`docs/ai/deltas/`) is archived and no longer active. All Shadow updates now go through standard pull requests.
