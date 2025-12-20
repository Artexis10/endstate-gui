# Autosuite GUI

Autosuite GUI is the official desktop application for **Autosuite**, providing a graphical interface for running provisioning, configuration restore, and verification workflows.

The GUI is designed to consume Autosuite strictly through its public CLI interface, ensuring a clear separation between the engine and the user interface.

## Status

This project is under active development and is not yet intended for general use.

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

1. GUI calls `autosuite capabilities --json`
2. GUI validates `schemaVersion` is compatible
3. If incompatible, GUI shows clear error and refuses to execute
4. If compatible, GUI proceeds with CLI invocation

#### Production Mode

Production builds of Autosuite GUI bundle a pinned Autosuite binary:

1. GUI ships with a specific Autosuite CLI version
2. GUI validates bundled CLI on startup via `capabilities`
3. Version mismatch indicates corrupted installation

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

See `docs/cli-json-contract.md` in the autosuite repository for the full contract specification.

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
