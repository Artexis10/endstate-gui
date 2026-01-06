# Endstate UX Guardrails

This document defines behaviors, features, terminology, and UX patterns that  
**Endstate must never introduce**.

These guardrails exist to prevent UX drift, accidental complexity,  
semantic ambiguity, and unsafe automation as the project grows.

If a proposed change violates any rule in this document,  
**it must be rejected or redesigned**.

---

## Core Principle

Endstate optimizes for:

- safety  
- clarity  
- predictability  
- user trust  

Automation coverage is always secondary.

**Trust is the product.**

---

## Forbidden Behaviors (Non-Negotiable)

### ❌ Automatic Configuration Restore

Endstate must never:

- restore app settings without explicit user opt-in  
- infer that a configuration “should” be restored  
- silently capture configuration during install scans  

Install-only is the default and must remain so.

---

### ❌ Secrets or Credentials Handling

Endstate must never:

- capture browser profiles  
- restore authentication tokens  
- restore password managers  
- restore license blobs  
- offer partial credential restore  

Secrets are intentionally unsupported.

There is no UI, CLI flag, or override for secrets.

---

### ❌ Hidden State

Endstate must never:

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

If explanation requires jargon, it belongs in **Advanced Mode** or documentation.

---

### ❌ Treating Normal Outcomes as Errors

Endstate must never warn or error for:

- install-only profiles  
- apps without restorable configuration  
- skipped configuration restoration  
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

Endstate must never:

- allow the GUI to do something the CLI cannot  
- produce artifacts the CLI cannot reproduce  
- maintain GUI-only logic paths  

The CLI remains the source of truth.

---

## Semantic & State Guardrails (Critical)

### ❌ Ambiguous Status Language

Endstate must never:

- overload a single status to mean multiple things  
- conflate *skipped*, *already installed*, and *no-op*  
- use positive language for unresolved state  

Each outcome must map to **one semantic meaning**.

---

### ❌ Collapsing Preview and Execution Semantics

Endstate must never:

- treat preview (dry-run) output as execution results  
- mark “would install” as “installed”  
- reuse execution language for previews  

Preview must always be explicitly hypothetical.

---

### ❌ Multiple Sources of Truth

Endstate must never:

- compute counts differently across UI components  
- infer state from logs instead of structured envelopes  
- allow UI fallbacks to fabricate results  

All state must come from **engine envelopes**.

---

### ❌ Silent Re-Execution

Endstate must never:

- re-run Apply implicitly after preview  
- auto-trigger installs after modal confirmation  
- hide command boundaries from the user  

Every execution must be **explicit and intentional**.

---

## Apply / Verify UX Contract

### Apply

Apply is for **changing the machine**.

- Preview = `apply --dry-run`
- Apply = `apply`
- ApplyResultModal is the only result surface
- If any action is required → machine is **not ready**

Apply language must use:
- changes
- installs
- results

Never:
- “apps checked”
- “up to date” (unless literally zero actions possible)

---

### Verify

Verify is for **observing the machine**.

- No changes
- No installs
- No remediation

Verify answers:
> “Does this machine match expectations?”

Apply answers:
> “What will happen if I act?”

These concepts must never bleed into each other.

---

## Review Checklist (Use in PRs)

Before approving UX changes, ask:

- Does this expose jargon to non-technical users?
- Does this introduce hidden or inferred state?
- Does this reduce safety in favor of convenience?
- Does this collapse preview and execution semantics?
- Does this create ambiguous status language?
- Does this diverge from CLI behavior?

If **yes** to any → redesign required.

---

## Long-Term Intent

Endstate is **not** a data migration tool.  
Endstate is **not** a personalization sync tool.

Endstate is a **machine provisioning and hydration system**.

Trust is the product.
