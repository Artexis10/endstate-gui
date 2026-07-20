# Endstate GUI

Endstate GUI is the official desktop app for **Endstate** — set up a new Windows PC by reinstalling your apps and restoring your settings from one portable file. Free and open source. It gives you a graphical interface to scan your current machine, save your apps and settings, and restore them on a fresh Windows install in minutes.

Website: <https://substratesystems.io/endstate> · Download: <https://substratesystems.io/download>

The GUI is designed to consume Endstate strictly through its public CLI interface, ensuring a clear separation between the engine and the user interface.

Endstate is governed by a set of public principles documented in the engine repository: [Endstate Principles](https://github.com/Artexis10/endstate/blob/main/PRINCIPLES.md). These apply to both the engine and the GUI and constrain product, pricing, and architecture decisions.

## Status

![engine pin](https://img.shields.io/badge/engine-v2.25.0-blue)

Endstate GUI is in active development approaching v1.0 release.

## Development Prerequisites

### Windows

- **Node.js** (v18+) and npm
- **Rust** via [rustup](https://rustup.rs/) (provides `cargo` and `rustc`)
- **Microsoft Visual C++ Build Tools** with:
  - MSVC v143 (or later) C++ build tools
  - Windows 10/11 SDK
  - These are required for the Rust linker and native compilation

Install Build Tools via [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) or the full Visual Studio installer.

### Running the Development Server

```bash
npm install
npm run tauri dev
```

### Regenerating Icons

If `src-tauri/icons/` is empty or icons need updating:

```bash
npm run tauri icon app-icon.png
```

## Relationship to Endstate

Endstate GUI relies on the Endstate CLI being installed and available on the system PATH.  
All operations are executed by invoking the CLI and consuming its structured output.

Both Endstate (the core engine) and Endstate GUI are open source, licensed under the Apache License 2.0.

---

## UI Component Guidelines

**All visible interactive UI components must use shadcn/ui components unless there is a documented exception.**

This ensures:
- Consistent theming and dark mode support
- Accessible keyboard navigation
- Predictable behavior across the application

### Standard Components

Use these shadcn components for interactive elements:
- **Select** (`@/components/ui/select`) - for dropdowns and selectors
- **Button** (`@/components/ui/button`) - for all clickable actions
- **Checkbox** (`@/components/ui/checkbox`) - for boolean toggles in forms
- **RadioGroup** (`@/components/ui/radio-group`) - for mutually exclusive options
- **Switch** (`@/components/ui/switch`) - for on/off toggles
- **Dialog** (`@/components/ui/dialog`) - for modals and overlays
- **Input** (`@/components/ui/input`) - for text inputs

### Exceptions

Native HTML elements may be used for:
- Custom interactive patterns without shadcn equivalents (e.g., collapsible sections, custom toggle groups)
- Non-interactive semantic markup
- Cases where shadcn components would conflict with existing behavior

All exceptions should be documented in code comments.

---

## CLI Integration Architecture

### Design Principles

1. **Thin GUI:** Endstate GUI contains no business logic, no provisioning logic, and makes no assumptions about internal CLI implementation.

2. **CLI as Source of Truth:** All operations are executed by CLI invocation. GUI is purely a presentation layer.

3. **Explicit Versioning:** Both CLI and schema versions are explicit and machine-readable.

4. **Graceful Degradation:** Unknown fields in JSON responses are ignored by the GUI.

### Execution Model

#### Development Mode

During development, Endstate GUI resolves the CLI from the system PATH:

- **CLI Resolution:** `endstate` command resolved from PATH
- **Execution:** Node.js `child_process.spawn`
- **Validation:** Capabilities handshake on startup

#### Production Mode

Production builds of Endstate GUI will bundle the Endstate engine as Tauri resources:

- **CLI Resolution:** Bundled engine scripts at known resource path
- **Execution:** Tauri/Rust Command API
- **Validation:** Capabilities handshake on startup

> **Note:** Engine bundling is in progress. Currently requires Endstate CLI on system PATH.

### Compatibility Check Flow

```
GUI starts
  │
  ├─► Call: endstate capabilities --json
  │
  ├─► Parse response
  │     │
  │     ├─► Check schemaVersion
  │     │     │
  │     │     ├─► Compatible? → Proceed
  │     │     │
  │     │     └─► Incompatible? → Show error, refuse execution
  │     │
  │     └─► Check cliVersion (informational)
  │
  └─► Ready for user commands
```

### JSON Contract

All CLI commands with `--json` flag return a standardized envelope:

```json
{
  "schemaVersion": "1.0",
  "cliVersion": "1.3.0",
  "command": "apply",
  "runId": "20241220-143052",
  "timestampUtc": "2024-12-20T14:30:52Z",
  "success": true,
  "data": { ... },
  "error": null
}
```

See `docs/ai/PROJECT_RULES.md` in the endstate repository for the authoritative contract rules.

### Supported Commands

| Command | JSON Support | Description |
|---------|--------------|-------------|
| `capabilities` | ✅ | Report CLI capabilities for handshake |
| `apply` | ✅ | Execute provisioning plan |
| `verify` | ✅ | Verify machine state against manifest |
| `report` | ✅ | Retrieve run history |

### Schema Versioning

- **Current Schema Version:** `1.0`
- Additive changes are backward-compatible
- Breaking changes require schema major version bump
- GUI must refuse execution if schema version is incompatible

---

## Hosted Backup

Endstate GUI surfaces the hosted-backup capability of the bundled engine
(`endstate backup *`, available from engine v2.0.0). All cryptography, HTTP,
JWT validation, and keychain access live in the engine — the GUI is a thin
presentation layer per the [Hosted Backup contract](https://github.com/Artexis10/endstate/blob/main/docs/contracts/hosted-backup-contract.md).

### Surfaces

- **Hosted Backup pane** — listed in the sidebar when the bundled engine
  advertises `features.hostedBackup.supported = true`. Hidden otherwise.
- **Sign-in / Sign-up / Recover** — three-tab auth pane. Sign-up generates a
  24-word recovery key; the user must save it via at least two of three
  methods (file, PDF, clipboard) before continuing. **There is no skip
  button**: per the contract trust model, a user who skips the recovery key
  and forgets their passphrase loses their data with no recourse from us.
- **Backup pane** — subscription banner (`active` / `grace` / `cancelled` /
  `none`), backup list, version list, push / restore / delete with
  streaming progress dialogs.
- **Restore-on-new-machine wizard** — auto-prompts when a signed-in user
  has remote backups but zero local profiles.
- **Account section in Settings** — email, subscription pill, manage link,
  sign-out, delete-account confirmation (email-match gate).

### Subscription portal

For v1, the Subscribe / Manage links go to:

- `https://substratesystems.io/#pricing` — Subscribe (state `none`)
- `https://substratesystems.io/account` — Manage subscription
  (state `active` / `grace` / `cancelled`)

Both open via Tauri's shell plugin (`@tauri-apps/plugin-shell`).

### Engine compatibility gate

On boot, the GUI reads `endstate capabilities --json` and checks
`features.hostedBackup.supported`. If absent or `false`, the auth pane,
Backup nav entry, and Account section are all hidden, and the user sees
"Update Endstate to enable Hosted Backup." Local provisioning continues to
work.

### Smoke-test plan (manual)

After install on a clean machine:

1. Sign up with a throwaway email + 12+ char passphrase
2. Save the recovery key via two of {file, PDF, copy} — confirm the dialog
   does not let you Continue with fewer than two saves and does not close on
   Escape
3. Land on the backup pane; confirm the subscription banner reflects the
   real state from substrate
4. Push a small test profile; cancel mid-push and confirm the toast
5. Pull to a different location; verify byte-equal round-trip
6. Sign out, sign back in on a different machine; confirm the wizard
   prompts to restore
7. Sign out again, choose "I forgot my passphrase", paste the saved
   24-word recovery key, set a new passphrase
8. Confirm the new passphrase signs in and the OLD passphrase no longer
   works (negative test — the recovery flow rotated keys)
9. From the account section, type the email exactly to enable the Confirm
   button; delete the account and confirm signed-out state

## Code Signing Policy

Free code signing provided by [SignPath.io](https://signpath.io), certificate by [SignPath Foundation](https://signpath.org).

**Team roles:**
- Committers and reviewers: [Hugo Ander Kivi](https://github.com/Artexis10)
- Approvers: [Hugo Ander Kivi](https://github.com/Artexis10)

**Privacy policy:** This program will not transfer any information to other networked systems unless specifically requested by the user or the person installing or operating it.

## License

Licensed under the Apache License, Version 2.0. See the [LICENSE](LICENSE) file for details.

Copyright 2025-2026 Substrate Systems OÜ.

## Development Notes

### Engine Adapter

The GUI includes an **EngineAdapter** module (`src-tauri/src/engine_adapter.rs`) that provides streaming NDJSON output from the Endstate CLI to the frontend.

**Features:**
- Spawns the `endstate` CLI process with configurable arguments
- Reads stdout/stderr concurrently (non-blocking)
- Parses each line: valid JSON is passed through, plain text becomes log events
- Emits events to frontend via Tauri event channel `endstate://event`
- Emits fallback result if CLI exits without a terminal result event
- **runId tagging:** Every emitted event includes a `runId` field for tracking
- **One-run-at-a-time guard (v1):** Only one CLI run can be active at a time
- **Cancellation support:** Running processes can be cancelled via `engine_cancel`

**Event Types:**
- **Log events:** `{"type":"log","level":"info|warn|error","message":"...","runId":"..."}`
- **CLI envelope:** Full JSON response from CLI with `success`, `command`, `data`, `runId` fields
- **Fallback result:** `{"type":"result","ok":true|false,"command":"...","summary":{"exitCode":N},"raw":null,"runId":"..."}`
- **Cancelled result:** `{"type":"result","ok":false,"command":"...","summary":{"cancelled":true,"exitCode":N},"raw":null,"runId":"..."}`

### Testing the Streaming UI

1. Ensure `endstate` CLI is installed and on PATH
2. Run `npm run tauri dev`
3. Wait for CLI status to show "ready"
4. Click **Capabilities** to test streaming output
5. For **Verify** and **Apply**, update `SAMPLE_MANIFEST_PATH` in `src/App.tsx` to point to a valid manifest file
6. The current **Run ID** is displayed above the log when a run is active
7. Click **Cancel** to terminate a running process (emits a cancelled result)

### Cancellation

To cancel a running command:
1. Click the **Cancel** button while a run is active
2. The running CLI process will be terminated
3. A cancelled result event will be emitted with `summary.cancelled: true`
4. The UI will show the run as failed with cancellation info

**Note:** Only one run can be active at a time (v1 limitation). Attempting to start a new run while one is in progress will return an error.

### Running Rust Tests

```bash
cd src-tauri
cargo test
```

This runs unit tests for the parsing logic, runId injection, and cancellation in `engine_adapter.rs`.

---

## Notes

This repository exists to develop the official Endstate desktop experience.
