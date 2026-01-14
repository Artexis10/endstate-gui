# Endstate UX–Engine Contract

This document defines the binding contract between:
- User Experience (GUI)
- Engine behavior
- CLI capabilities

Its purpose is to ensure Endstate remains coherent, inspectable,
and predictable across interfaces.

If GUI and CLI behavior diverge, the system is broken.

---

## Fundamental Rule

Every GUI action must map to:
- a deterministic engine operation
- a reproducible CLI command
- a visible artifact

No exceptions.

---

## Concept: Profile (Setup)

### UX
- A “setup” the user creates and names
- Shown as a tangible item
- Has a clear storage location

### Engine
- Declarative plan file
- Optional hydration bundle
- Explicit restore steps only

### CLI

~~~bash
endstate capture --profile "My Setup"
endstate apply --profile "My Setup"
~~~

---

## Concept: Profile Location

### UX
- Clearly displayed
- Openable
- Copyable path

### Engine
Profiles are stored under:

Documents/Endstate/Profiles

### CLI

~~~bash
endstate profiles list
endstate profiles path "My Setup"
~~~

---

## Concept: “Keep Settings”

### UX
- Per-app toggle
- Disabled by default
- Framed as optional

### Engine
- restore.enabled: true
- Explicit restore steps only
- No implicit capture

### CLI

~~~bash
endstate capture --include-config vscode,git
~~~

No flag means install-only.

---

## Concept: Advanced Mode

### UX
- Optional toggle
- Sticky preference
- Reveals technical details only

### Engine
- No effect
- No behavior change

### CLI
Not applicable.

Advanced Mode reveals information only.  
It never unlocks unsafe behavior.

---

## Concept: Unsupported / Blocked Apps

### UX
- Not offered
- Or shown as “Not supported”

### Engine
- Hard exclusion list
- Validation prevents restore steps

### CLI

~~~bash
endstate validate profile
~~~

Blocked behavior cannot be overridden.

---

## Concept: Re-run Safety

### UX
- Calm messaging
- No warnings for repeat runs

### Engine
- Idempotent operations
- Backup-before-restore
- Deterministic ordering

### CLI

~~~bash
endstate apply --profile "My Setup"
endstate verify --profile "My Setup"
~~~

---

## Error Semantics Contract

Errors occur only when:
- an app installation fails
- an explicit restore step fails
- verification fails

Absence of configuration is not an error.

---

## Capture Artifact Contract (INV-CAPTURE)

### Invariants

1. **Success implies artifact exists and is valid.**
   If capture returns `success:true`, then `outputPath` MUST exist and contain a valid manifest payload (not `{}`).

2. **CLI missing is a hard failure.**
   If the provisioning CLI entrypoint is missing, capture MUST return `success:false` with structured error code `ENGINE_CLI_NOT_FOUND`.

3. **No artifact on failure.**
   If capture fails, no manifest artifact is emitted and no `outputPath` is claimed.

### Failure Mode Table

| Error Code | Cause | GUI Behavior |
|------------|-------|--------------|
| `ENGINE_CLI_NOT_FOUND` | Provisioning CLI not found at configured path | Show actionable toast: use `error.hint` if present, else "Engine CLI not found. Configure Engine path in Settings." |
| `MANIFEST_WRITE_FAILED` | Capture succeeded but file write failed | Show `error.message` verbatim |
| `CAPTURE_FAILED` | Generic capture failure | Show `error.message` verbatim |
| (no error code) | Unknown failure | Show "Capture failed" |

### GUI Enforcement

- GUI MUST NOT persist draft content if capture returned `success:false`
- GUI MUST NOT persist draft content if manifest payload is empty (`{}`)
- GUI MUST surface `ENGINE_CLI_NOT_FOUND` with actionable hint mentioning Settings

### CLI Path Resolution

Engine script path resolution order (for script mode):
1. User-configured path (if exists)
2. `<repoRoot>\bin\endstate.ps1` (preferred)
3. `<repoRoot>\bin\endstate.cmd` (fallback)
4. Legacy `<repoRoot>\endstate.ps1` (migration only)

---

## Contract Violations (Considered Bugs)

The following are bugs:
- GUI-only behavior
- Silent configuration restore
- Profiles stored outside Documents
- Hidden state not representable via CLI
- Advanced mode changing behavior

---

## Final Intent

Endstate is a transparent system.

Users should always be able to:
- understand what will happen
- predict outcomes
- inspect artifacts
- reproduce behavior

The GUI explains.  
The engine executes.  
The CLI guarantees truth.
