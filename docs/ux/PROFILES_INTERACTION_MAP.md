# Profiles Interaction Map — v1

**Source of truth:** UX_CONTRACTS.md  
**Surface:** Profiles  
**Applies to:** Simplified and Detailed modes  
**Purpose:** Ensure profile management is safe, understandable, and free of dead affordances

---

## Contract Alignment

This interaction map is derived from and constrained by `UX_CONTRACTS.md`.

In particular, it enforces:
- G-1 No Dead Affordances
- G-2 No Invisible State Transitions
- G-3 Mode Must Never Break Discoverability
- M-1 Simplified Mode Contract
- I-2 Action Feedback Contract
- I-3 Disabled State Contract
- I-4 Empty State Contract

---

## Surface Definition

**User mental model:**  
“I want to select, understand, and manage profiles without breaking anything.”

Profiles define **configuration**, not execution.

---

## Entry States

### E1 — No Profiles Exist
- No profiles are available

**Guaranteed visibility**
- Explicit empty state
- Clear explanation of what profiles are
- Clear indication of how a profile is created

---

### E2 — Profiles List
- One or more profiles exist

**Guaranteed visibility**
- Each profile communicates:
  - Name
  - Purpose or role (high level)
  - Whether it is active or selectable

---

### E3 — Profile Selected
- A profile has been selected for use

**Guaranteed visibility**
- Active selection is explicit
- User understands which profile is in effect

---

### E4 — Profile Management Action
- A profile action has been invoked (rename, duplicate, delete, etc.)

**Guaranteed visibility**
- Action acknowledgment
- Clear outcome or next step

---

## Primary User Intents

1. See available profiles
2. Select a profile
3. Understand what a profile does
4. Manage profiles safely
5. Avoid accidental or destructive changes

---

## Core Interaction Flows

### Flow A — Viewing Profiles List

**Intent:** Understand what profiles exist

1. User navigates to Profiles
2. System presents either:
   - **E1 — No Profiles Exist**, or
   - **E2 — Profiles List**

**Must satisfy**
- I-4 Empty State Contract (if E1)

**Forbidden**
- Blank list with no explanation
- Profiles with no indication of purpose

---

### Flow B — Selecting a Profile

**Intent:** Choose a profile to use

1. User selects a profile
2. System immediately acknowledges selection
3. System transitions to **E3 — Profile Selected**

**Guaranteed**
- User can tell which profile is active
- Selection has visible effect

**Forbidden**
- Selection with no visible confirmation
- Silent profile changes

---

### Flow C — Understanding a Profile

**Intent:** Know what a profile does

When a profile is viewed or selected:
- Its purpose must be understandable at a high level
- User must not need technical knowledge to grasp intent

**Mode behavior**
- Simplified: purpose and effect only
- Detailed: may expose configuration or internals

**Forbidden**
- Profiles that require guessing
- Meaning only understandable via raw config

---

### Flow D — Managing Profiles

**Intent:** Modify profiles safely

1. User invokes a profile management action
2. System acknowledges the action
3. Outcome is explicit (success, cancellation, failure)

**Mode behavior**
- Simplified: only safe, non-destructive actions exposed
- Detailed: may expose advanced or destructive actions

**Must satisfy**
- G-1 No Dead Affordances
- I-2 Action Feedback Contract
- I-3 Disabled State Contract

**Forbidden**
- Destructive actions exposed without clarity
- Actions that do nothing in Simplified mode
- Disabled actions without explanation

---

### Flow E — Leave and Return

**Intent:** Resume understanding later

If the user leaves and returns:
- Profile list remains legible
- Active profile remains clear
- No silent profile changes have occurred

**Forbidden**
- Active profile changing without user action
- Loss of understanding after navigation

---

## Mode Differences

### Simplified Mode

**Guarantees**
- Profile selection is always safe
- Only non-destructive actions are visible
- Profiles are understandable without technical detail

**Never**
- Expose advanced configuration
- Expose destructive actions
- Require interpretation of internal settings

---

### Detailed Mode

**Guarantees**
- Same primary flows as Simplified
- Additional power and visibility allowed

**May expose**
- Configuration details
- Advanced management actions
- Technical metadata

**Must still obey**
- G-1 No Dead Affordances
- G-2 No Invisible State Transitions

---

## Forbidden States (Contract Violations)

These states must never exist:

- Profile selection without visible confirmation
- Actions that appear clickable but do nothing
- Disabled actions with no explanation
- Profiles whose purpose cannot be understood
- Active profile changing invisibly
- Destructive actions exposed without clarity

---

## Validation Checklist

This interaction map is valid only if all are true:

- Active profile is always explicit
- Every action produces visible feedback
- Simplified mode exposes only safe, complete paths
- No management action exists without resolution
- Returning users can reconstruct current state

---

**Status:** Profiles Interaction Map v1 — Complete
