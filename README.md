# Autosuite GUI

Autosuite GUI is the official desktop application for **Autosuite**, providing a graphical interface for running provisioning, configuration restore, and verification workflows.

The GUI is designed to consume Autosuite strictly through its public CLI interface, ensuring a clear separation between the engine and the user interface.

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

## Relationship to Autosuite

Autosuite GUI relies on the Autosuite CLI being installed and available on the system PATH.  
All operations are executed by invoking the CLI and consuming its structured output.

Autosuite (the core engine) is open source and licensed under the Apache License 2.0.  
Autosuite GUI is a separate project with its own licensing and distribution model.

---

## CLI Integration Architecture

### Design Principles

1. **Thin GUI:** Autosuite GUI contains no business logic, no provisioning logic, and makes no assumptions about internal CLI implementation.

2. **CLI as Source of Truth:** All operations are executed by CLI invocation. GUI is purely a presentation layer.

3. **Explicit Versioning:** Both CLI and schema versions are explicit and machine-readable.

4. **Graceful Degradation:** Unknown fields in JSON responses are ignored by the GUI.

### Execution Model

#### Development Mode

During development, Autosuite GUI resolves the CLI from the system PATH:

- **CLI Resolution:** `autosuite` command resolved from PATH
- **Execution:** Node.js `child_process.spawn`
- **Validation:** Capabilities handshake on startup

#### Production Mode

Production builds of Autosuite GUI bundle a pinned Autosuite CLI binary:

- **CLI Resolution:** Bundled binary at known path
- **Execution:** Tauri/Rust Command API
- **Validation:** Capabilities handshake on startup

### Compatibility Check Flow

```
GUI starts
  │
  ├─► Call: autosuite capabilities --json
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

See `.windsurf/rules/project-ruleset.md` in the autosuite repository for the authoritative contract rules.

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

Copyright © Substrate Systems OÜ.  
All rights reserved.

This repository does not grant permission to use, modify, or redistribute the code unless explicitly stated otherwise.

## Notes

This repository exists to develop the official Autosuite desktop experience.  
Details about distribution, pricing, and supported platforms will be documented closer to release.
