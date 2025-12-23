# Autosuite UX–Engine Contract

This document defines the binding contract between:
- User Experience (GUI)
- Engine behavior
- CLI capabilities

Its purpose is to ensure Autosuite remains coherent, inspectable,
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
autosuite capture --profile "My Setup"
autosuite apply --profile "My Setup"
~~~

---

## Concept: Profile Location

### UX
- Clearly displayed
- Openable
- Copyable path

### Engine
Profiles are stored under:

Documents/Autosuite/Profiles

### CLI

~~~bash
autosuite profiles list
autosuite profiles path "My Setup"
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
autosuite capture --include-config vscode,git
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
autosuite validate profile
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
autosuite apply --profile "My Setup"
autosuite verify --profile "My Setup"
~~~

---

## Error Semantics Contract

Errors occur only when:
- an app installation fails
- an explicit restore step fails
- verification fails

Absence of configuration is not an error.

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

Autosuite is a transparent system.

Users should always be able to:
- understand what will happen
- predict outcomes
- inspect artifacts
- reproduce behavior

The GUI explains.  
The engine executes.  
The CLI guarantees truth.
