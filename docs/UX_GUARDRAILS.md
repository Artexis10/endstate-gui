# Autosuite UX Guardrails

This document defines behaviors, features, and UX patterns that
Autosuite must never introduce.

These guardrails exist to prevent UX drift, accidental complexity,
and unsafe automation as the project grows.

If a proposed change violates any rule in this document,
it must be rejected or redesigned.

---

## Core Principle

Autosuite optimizes for:
- safety
- clarity
- predictability
- user trust

Automation coverage is always secondary.

---

## Forbidden Behaviors (Non-Negotiable)

### ❌ Automatic Configuration Restore
Autosuite must never:
- restore app settings without explicit user opt-in
- infer that a config “should” be restored
- silently capture configuration during install scans

Install-only is the default and must remain so.

---

### ❌ Secrets or Credentials Handling
Autosuite must never:
- capture browser profiles
- restore authentication tokens
- restore password managers
- restore license blobs
- offer partial credential restore

Secrets are intentionally unsupported.

There is no UI, CLI flag, or override for secrets.

---

### ❌ Hidden State
Autosuite must never:
- store profiles in AppData
- maintain invisible internal state
- rely on hidden databases for user setups

All user-relevant state must be visible and inspectable.

---

### ❌ Jargon in Default UX
Default (non-advanced) UI must never expose:
- file paths
- registry keys
- environment variables
- config formats (JSON, YAML, INI)
- technical terms (HKCU, ProgramData, etc.)

If explanation requires jargon, it belongs in Advanced Mode or documentation.

---

### ❌ Treating Normal Outcomes as Errors
Autosuite must never warn or error for:
- install-only profiles
- apps without restorable config
- skipped config restoration
- partial restore selection

Expected outcomes must feel calm and intentional.

---

### ❌ Advanced Mode as a Requirement
Advanced Mode must never:
- be required to complete core workflows
- unlock unsafe behavior
- change defaults
- bypass exclusions

Advanced Mode is visibility, not authority.

---

### ❌ GUI–CLI Divergence
Autosuite must never:
- allow the GUI to do something the CLI cannot
- produce artifacts the CLI cannot reproduce
- maintain GUI-only logic paths

The CLI remains the source of truth.

---

## Review Checklist (Use in PRs)

Before approving UX changes, ask:
- Does this expose jargon to non-technical users?
- Does this introduce hidden state?
- Does this reduce safety in favor of convenience?
- Does this create an implicit behavior instead of explicit choice?
- Does this break CLI parity?

If yes to any → redesign required.

---

## Long-Term Intent

Autosuite is not a data migration tool.
Autosuite is a machine provisioning and hydration system.

Trust is the product.
