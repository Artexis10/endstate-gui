# Autosuite UX Principles

This document defines the non-negotiable UX principles for Autosuite.
It exists to prevent UX drift and to ensure Autosuite remains safe,
predictable, and usable for non-technical users while still empowering
technical and power users.

This is a **design contract**, not user documentation.

---

## Core Audience

Autosuite is designed **non-technical users first**.

Power users and technical users are fully supported through:
- transparency
- inspectable artifacts
- progressive disclosure
- CLI parity

At no point should Autosuite require technical knowledge to use safely.

---

## Core Mental Model (Must Always Hold)

> A setup is a folder in Documents that Autosuite uses to reinstall your apps and optionally restore some app settings.

If this statement ever becomes untrue, the product has regressed.

---

## Defaults (Non-Negotiable)

- App installation is the default behavior
- Configuration restore is **OFF by default**
- Secrets and credentials are **not supported**
- Registry restore is **OFF by default**
- Install-only profiles are a **successful outcome**
- Profiles are stored in:
  
  Documents/Autosuite/Profiles

No configuration should ever be silently captured or restored.

---

## Safety & Trust Principles

- Autosuite must be safe to re-run infinitely
- No destructive actions without backup
- No hidden state
- No silent failures
- No irreversible actions without explicit confirmation

User trust is more important than automation coverage.

---

## Capture UX Principles

### Capture is Guided, Not Technical

- Users select apps
- Users optionally select “Keep settings” per app
- Paths, registry keys, and config internals are hidden by default
- Unsafe or unsupported categories (e.g. browsers, credentials) are not offered

### Secrets & Credentials

Secrets and credentials are intentionally excluded.
There is no UI, flag, or partial support for restoring secrets.

This includes (but is not limited to):
- browser profiles
- password managers
- auth tokens
- license blobs

---

## Progressive Disclosure

Autosuite uses **progressive disclosure** instead of separate “modes”.

### Default Mode
- No jargon
- No file paths
- No registry references
- Clear, calm language
- Predictable behavior

### Advanced Mode (Power Users)
- Optional and user-enabled
- Reveals technical details
- Does not change defaults
- Never unlocks unsafe behavior

Advanced mode reveals information; it does not change Autosuite’s safety model.

---

## Profiles Are First-Class Artifacts

- Profiles are visible folders/files
- Users can open the folder
- Users can copy the path
- Users can back up or move profiles manually
- Profiles are never hidden in AppData

Autosuite must never treat profiles as opaque internal state.

---

## CLI and GUI Parity

- GUI and CLI produce the same artifacts
- GUI actions must be reproducible via CLI
- GUI must not invent state the CLI cannot represent
- CLI remains the source of truth

---

## UX Success States

The following are normal and successful outcomes:
- No settings restored
- Install-only profiles
- Partial restore (some apps only)
- Skipped apps

These must never be shown as warnings or errors.

---

## UX Failure States (Only These)

Errors should only occur when:
- an app fails to install
- a restore step explicitly fails
- user-selected operations cannot complete

Absence of configuration is not a failure.

---

## Long-Term Design Intent

Autosuite is not a migration tool for personal data.
Autosuite is a **machine provisioning and hydration system**.

Automation must never come at the cost of user understanding or trust.
