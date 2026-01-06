# Reports Interaction Map — v1

**Source of truth:** UX_CONTRACTS.md  
**Surface:** Reports  
**Applies to:** Simplified and Detailed modes  
**Purpose:** Ensure reports are always understandable, clickable, and state-visible without dead affordances

---

## Contract Alignment

This interaction map is derived from and constrained by `UX_CONTRACTS.md`.

In particular, it enforces:
- G-1 No Dead Affordances
- G-2 No Invisible State Transitions
- G-3 Mode Must Never Break Discoverability
- M-1 Simplified Mode Contract
- I-1 Expand / Collapse Contract
- I-2 Action Feedback Contract
- I-4 Empty State Contract
- I-5 Status Representation Contract

---

## Surface Definition

**User mental model:**  
“I want to see what happened, understand the outcome, and optionally inspect details.”

Reports are **historical truth**, not live execution.

---

## Entry States

### E1 — No Reports Exist
- No prior runs available

**Guaranteed visibility**
- Explicit empty state
- Clear explanation why nothing is shown
- Clear indication of what action creates reports

---

### E2 — Reports List (Collapsed)
- One or more reports exist
- Reports are visible in summary form

**Guaranteed visibility**
- Each report communicates:
  - Outcome
  - Timestamp
  - High-level status

---

### E3 — Report Expanded
- A specific report has been expanded

**Guaranteed visibility**
- Expansion reveals meaningful content
- User understands more than they did before expanding

---

### E4 — Report Action Taken
- A secondary action has been invoked (if applicable)

**Guaranteed visibility**
- Action acknowledgment
- Clear result or navigation

---

## Primary User Intents

1. See whether runs succeeded or failed
2. Understand what happened at a high level
3. Inspect a specific run
4. Take follow-up actions (if available)
5. Return later and still understand past outcomes

---

## Core Interaction Flows

### Flow A — Viewing Reports List

**Intent:** Get an overview

1. User navigates to Reports
2. System presents either:
   - **E1 — No Reports Exist**, or
   - **E2 — Reports List (Collapsed)**

**Must satisfy**
- I-4 Empty State Contract (if E1)
- I-5 Status Representation Contract (if E2)

**Forbidden**
- Blank screen
- List without explanation
- Status that requires logs to interpret

---

### Flow B — Expanding a Report

**Intent:** Understand a specific run

1. User expands a report
2. System transitions to **E3 — Report Expanded**
3. Expanded view reveals:
   - Additional information, or
   - Available actions, or
   - A clear explanation if no further detail exists

**Mode behavior**
- Simplified: summary + outcome only
- Detailed: summary + internals + secondary actions

**Must satisfy**
- I-1 Expand / Collapse Contract

**Forbidden**
- Expandable affordance that reveals nothing
- Expansion that changes state invisibly

---

### Flow C — Reading Report Outcome

**Intent:** Know what happened

Within an expanded report:
- Outcome must be explicit
- Success, warning, or failure must be legible
- User must not infer outcome from absence of errors

**Mode behavior**
- Simplified: single dominant outcome
- Detailed: may show sub-states or phases

**Forbidden**
- Ambiguous “completed” without success/failure
- Outcome visible only via technical detail

---

### Flow D — Taking a Report Action

**Intent:** Act on a report (if applicable)

1. User invokes a visible report action
2. System immediately acknowledges the action
3. Action resolves visibly (navigation, result, or explanation)

**Mode behavior**
- Simplified: only outcome-safe actions exposed
- Detailed: may expose advanced actions

**Must satisfy**
- G-1 No Dead Affordances
- I-2 Action Feedback Contract

**Forbidden**
- Visible actions that do nothing in Simplified mode
- Actions that fail silently
- Actions gated by mode without explanation

---

### Flow E — Leave and Return

**Intent:** Resume understanding later

If the user leaves and returns:
- Reports list remains legible
- Outcomes remain clear
- Expanded state is either:
  - Restored, or
  - Clearly reset with no loss of understanding

**Forbidden**
- Reports that appear to vanish
- State that resets without explanation

---

## Mode Differences

### Simplified Mode

**Guarantees**
- All visible reports are fully understandable
- Expand reveals only meaningful, non-technical information
- No expandable affordance without content

**Never**
- Expose inert controls
- Expose technical-only actions
- Require interpretation of logs or internals

---

### Detailed Mode

**Guarantees**
- Same primary flows as Simplified
- Additional context and actions allowed

**May expose**
- Logs
- File links
- Phase-level detail
- Secondary actions

**Must still obey**
- G-1 No Dead Affordances
- G-2 No Invisible State Transitions

---

## Forbidden States (Contract Violations)

These states must never exist:

- Report rows that appear clickable but do nothing
- Expanded reports with empty content in Simplified mode
- Status that can only be understood via logs
- Actions visible in Simplified mode that are no-ops
- Mode-gated behavior without explanation
- Reports list that looks empty without explanation

---

## Validation Checklist

This interaction map is valid only if all are true:

- Every report communicates an outcome
- Every expandable affordance reveals value
- Simplified mode exposes only complete, safe paths
- No report action exists without visible resolution
- Returning users can reconstruct past events

---

**Status:** Reports Interaction Map v1 — Complete
