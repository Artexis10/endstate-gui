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

3. **One run at a time.** Only one CLI process can be active. Concurrent execution is blocked at the Rust layer.

4. **Schema version compatibility required.** GUI refuses execution if CLI schema version is incompatible.

5. **All user-relevant state must be visible.** No hidden state in AppData or invisible databases.

6. **Configuration restore is OFF by default.** Install-only is the default behavior.

7. **Secrets and credentials are never handled.** No browser profiles, tokens, or license blobs.

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

7. **Coverage thresholds enforced.** Vitest coverage thresholds (70% lines, 55% functions, 60% branches) will fail CI if not met.

---

## 7. Non-Goals

1. **Not a data migration tool.** Endstate does not migrate personal data, browser profiles, or credentials.

2. **Not a personalization sync tool.** Endstate provisions machines; it does not sync preferences across devices.

3. **No automatic configuration restore.** Config restore requires explicit user opt-in per app.

4. **No hidden internal state.** Profiles are never stored in AppData or invisible locations.

5. **No GUI-only features.** Everything the GUI does must be reproducible via CLI.

6. **No secrets handling.** Browser profiles, auth tokens, password managers, and license blobs are intentionally unsupported with no override.

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
- Shadow-level changes require Delta Shadow proposal

### Escalation

- Unclear intent → ask, do not assume
- Contract conflicts → prefer repository code, propose Delta Shadow
- UX guardrail violations → redesign required
