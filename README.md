# Endstate GUI

Endstate GUI is the official desktop application for **Endstate**, providing a graphical interface for running provisioning, configuration restore, and verification workflows.

The GUI is designed to consume Endstate strictly through its public CLI interface, ensuring a clear separation between the engine and the user interface.

## Status

This project is under active development and is not yet intended for general use.

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

Endstate (the core engine) is open source and licensed under the Apache License 2.0.  
Endstate GUI is a separate project with its own licensing and distribution model.

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

Production builds of Endstate GUI bundle a pinned Endstate CLI binary:

- **CLI Resolution:** Bundled binary at known path
- **Execution:** Tauri/Rust Command API
- **Validation:** Capabilities handshake on startup

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
  "cliVersion": "0.1.0",
  "command": "apply",
  "runId": "20241220-143052",
  "timestampUtc": "2024-12-20T14:30:52Z",
  "success": true,
  "data": { ... },
  "error": null
}
```

See `.windsurf/rules/project-ruleset.md` in the endstate repository for the authoritative contract rules.

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

## License

This software is proprietary and confidential.

Copyright © 2025 Substrate Systems OÜ.
All rights reserved.

Use, modification, or redistribution of this software is prohibited
except as explicitly permitted by a written agreement with
Substrate Systems OÜ.

See the LICENSE file for details.

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
Details about distribution, pricing, and supported platforms will be documented closer to release.
