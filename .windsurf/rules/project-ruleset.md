# Autosuite GUI — Project Ruleset

## Purpose

The autosuite-gui project is a **thin, deterministic user interface** over the Autosuite CLI (engine).

The GUI is responsible for **presentation and orchestration only**.
All provisioning logic, validation, state, and truth live in the Autosuite engine.

This ruleset exists to prevent logic drift, contract violations, and accidental reimplementation of engine behavior in the GUI.

---

## Core Architectural Principles

### Engine Is the Source of Truth
- Autosuite CLI is authoritative for:
  - install state
  - verification results
  - errors
  - versions
  - exit codes
- The GUI MUST NOT infer, reconstruct, or override engine state.

### JSON Is the Contract
- The GUI MUST invoke the Autosuite CLI with `--json` (or equivalent) **at all times**.
- The GUI MUST rely exclusively on structured JSON output.
- The GUI MUST NOT parse or depend on human-readable CLI text.

---

## CLI Interaction Rules

### Invocation
- All CLI calls MUST:
  - include `--json` 
  - capture stdout, stderr, and exit code separately
- Non-zero exit codes MUST be treated as failures, even if JSON is returned.

### Stdout Handling
- Stdout MUST be treated as **pure JSON**.
- If stdout cannot be parsed as JSON, the run MUST be considered failed.
- The GUI MUST NOT attempt to "recover" by filtering text.

### Stderr / Information Streams
- stderr and other non-stdout streams may be displayed to the user as diagnostics.
- These streams MUST NOT affect application state or success/failure determination.

---

## Responsibility Boundaries

### The GUI MAY:
- Render progress and results
- Visualize drift and verification outcomes
- Provide UX affordances (confirmations, warnings, summaries)
- Export JSON reports produced by the engine

### The GUI MUST NOT:
- Reimplement install, verify, or planning logic
- Guess missing parameters or auto-correct manifests
- Retry destructive actions automatically
- Mutate manifests or engine state without explicit user action

---

## Error Handling Rules

- All errors MUST originate from the engine JSON envelope.
- The GUI MUST display engine error messages verbatim (no reinterpretation).
- The GUI MUST NOT invent error categories not present in the engine response.

---

## Testability Requirements

### Mock Mode
- The GUI MUST support a mock/offline mode using saved JSON envelopes.
- UI rendering MUST be testable without invoking the real CLI.

### Testing Constraints
- GUI tests MUST NOT:
  - install software
  - modify the host system
  - depend on machine-specific state
- All integration tests MUST use mocked CLI responses.

---

## Evolution Rules

- Any change to the CLI JSON schema or behavior MUST:
  - be documented in the Autosuite engine ruleset
  - be reflected here if it affects GUI assumptions
- The GUI must remain backward-compatible with the documented engine contract.

---

## Non-Goals

- autosuite-gui is NOT a configuration management engine.
- autosuite-gui is NOT a policy engine.
- autosuite-gui is NOT responsible for idempotency or safety guarantees.

Those guarantees belong exclusively to Autosuite (engine).

---

## Guiding Principle

> The GUI is replaceable.  
> The engine is not.

When in doubt, push logic down into the engine.

## Project-Specific Bindings (autosuite-gui)

This section binds the general GUI rules to the concrete structure and technologies used in autosuite-gui.

### Frontend (Vite + React + TypeScript)
- UI logic lives under `src/` 
- Files such as `App.tsx`, `main.tsx`, and UI components MUST remain presentation-only
- No provisioning, verification, or planning logic may be implemented in React components

### CLI Integration Layer
- `src/cli-bridge.ts` is the canonical location for:
  - spawning the Autosuite CLI
  - passing arguments
  - capturing stdout, stderr, and exit code
  - parsing JSON envelopes
- No other file may invoke the Autosuite CLI directly

### Engine Abstraction
- `src/engine-bridge.ts` exists to:
  - abstract CLI vs future embedded/remote engine implementations
  - provide a stable interface to the UI layer

## Canonical paths (do not guess)
Project ruleset file (canonical, always edit this exact file when updating rules):
C:\Users\win-laptop\Desktop\projects\autosuite\.windsurf\rules\project-ruleset.md

Do not use PowerShell to edit normal repo files unless a write persistence issue is proven in this session. Default to normal edits. PowerShell fallback only after one failed normal edit, and only for the specific file that failed.
## Storage Namespace Isolation

To prevent test/web settings from affecting Tauri runtime, localStorage keys are namespaced.

### Namespace Selection
1. **VITE_STORAGE_NS env var** - If set (e.g., "test" for Playwright), uses that namespace
2. **"tauri"** - Automatically selected when running in Tauri runtime (detected via import.meta.env.TAURI_PLATFORM)
3. **"web"** - Default for plain browser

### Key Format
Keys are prefixed with namespace: `{namespace}:{key}`
- Tauri: `tauri:autosuite-gui-settings`
- Web: `web:autosuite-gui-settings`
- Test: `test:autosuite-gui-settings`

### Migration Rules
- **Tauri runtime**: NEVER reads from legacy un-namespaced keys (prevents pollution from web/test)
- **Web/Test**: Falls back to legacy keys and migrates them to namespaced keys

### Reset Settings
The Reset Settings function clears ALL known keys across ALL namespaces (tauri, web, test) plus legacy un-namespaced keys. This ensures the app can recover from any stuck state.

### Test Isolation
Playwright tests set `VITE_STORAGE_NS=test` in playwright.config.ts webServer.env to isolate test storage from Tauri dev storage.

## Engine Probe and Error Handling

The app probes the autosuite engine on startup via `capabilities --json`. This probe is **non-fatal**:

### Non-Blocking Error State
- Engine connection errors display as a **banner** within the normal UI, not a blocking modal
- Users can always navigate to Settings (Ctrl+, shortcut) even when engine is unreachable
- "Safe Mode" button dismisses the error and allows UI exploration without engine

### Diagnostics
The error banner includes collapsible diagnostics showing:
- Runtime detection (tauri vs web)
- TAURI_PLATFORM env var
- Engine mode and script path
- Error message and command attempted

### Keyboard Shortcuts
- **Ctrl+K**: Open command palette
- **Ctrl+,**: Open Settings (emergency shortcut, always works)
