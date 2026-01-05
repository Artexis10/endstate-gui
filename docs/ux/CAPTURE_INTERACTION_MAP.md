# Capture Interaction Map — v1

**Source of truth:** UX_CONTRACTS.md  
**Surface:** Capture  
**Applies to:** Simplified and Detailed modes  
**Purpose:** Prevent dead affordances and invisible state

---

## Surface Definition

**User mental model:**  
“I want to capture system state and know whether it worked.”

---

## Entry States

### E1 — Idle / Ready
- No capture running
- System is stable
- Capture is available

**Guaranteed visibility**
- Capture availability is obvious
- System readiness is legible

---

### E2 — Capture In Progress
- Capture has been initiated
- System is actively working

**Guaranteed visibility**
- Ongoing activity is visible
- User understands capture is running
- User understands whether they must wait or may navigate away

---

### E3 — Capture Completed (Uncommitted)
- Capture finished successfully
- Results exist
- Not yet finalized (if applicable)

**Guaranteed visibility**
- Completion is explicit
- Outcome is unambiguous

---

### E4 — Capture Completed (Committed)
- Capture is fully saved
- No further action required

**Guaranteed visibility**
- Success is explicit
- System is safe

---

### E5 — Capture Failed
- Capture attempted
- Failure occurred

**Guaranteed visibility**
- Failure is explicit
- System safety is communicated
- Next steps are visible

---

## Primary User Intents

1. Start a capture
2. Observe capture progress
3. Understand capture outcome
4. Recover from failure
5. Leave and return without losing understanding

---

## Core Interaction Flows

### Flow A — Start Capture

**Intent:** Start a capture

1. User initiates capture
2. System immediately acknowledges the action  
   _(must satisfy I-2 Action Feedback Contract)_
3. System transitions to **E2 — Capture In Progress**
4. Ongoing state is visible

**Forbidden**
- Silent start
- No visible state change
- Delayed or invisible acknowledgment

---

### Flow B — Capture In Progress

**Intent:** Understand what’s happening

While capture is running:
- User can see that capture is active
- User can see that the system is busy
- User is never left guessing whether capture started

**Mode behavior**
- Simplified: single dominant “in progress” signal
- Detailed: may expose sub-steps or internals

**Forbidden**
- Spinner without explanation
- Background work with no visible indicator
- State that appears idle while capture is active

---

### Flow C — Capture Success

**Intent:** Know the result

1. Capture finishes
2. System transitions to **E3** or **E4**
3. Completion is explicitly signaled
4. User understands:
   - Capture succeeded
   - Whether further action is required

**Must satisfy**
- G-2 No Invisible State Transitions
- I-5 Status Representation Contract

**Forbidden**
- Silent completion
- Success visible only in logs
- Success without clarity on next steps

---

### Flow D — Capture Failure

**Intent:** Understand and recover

1. Failure occurs
2. System transitions to **E5 — Capture Failed**
3. Error is explicit and first-class

**System must communicate**
- What failed (high level)
- Whether the system is safe
- What the user can do next

**Mode behavior**
- Simplified: reassurance + next step
- Detailed: cause + context

**Forbidden**
- Failure hidden behind logs
- Failure without recovery guidance
- Ambiguous “something went wrong”

---

### Flow E — Leave and Return

**Intent:** Resume understanding

If the user navigates away and returns:
- Current capture state MUST still be legible
- Outcome MUST still be visible

**Must satisfy**
- I-2 Action Feedback Contract (persistent resolution)

**Forbidden**
- Completed capture that appears never started
- Failed capture that resets to idle with no explanation

---

## Mode Differences

### Simplified Mode

**Guarantees**
- Only complete interaction paths are exposed
- No expandable affordances without content
- Single dominant state at all times

**Never**
- Expose partial or technical actions
- Show expandable regions that reveal nothing

---

### Detailed Mode

**Guarantees**
- Same primary flows as Simplified
- Additional context is allowed

**May expose**
- Sub-states
- Internals
- Secondary actions

**Must still obey**
- G-1 No Dead Affordances
- G-2 No Invisible State Transitions

---

## Forbidden States (Contract Violations)

These states must never exist:

- Capture action visible but inert
- Capture starts with no visible acknowledgment
- Capture completes with no explicit success or failure
- Expandable capture item that reveals nothing in Simplified mode
- Failure that requires logs to understand
- State changes that occur only in the background

---

## Validation Checklist

This interaction map is valid only if all are true:

- Every user action has visible acknowledgment
- Every state transition is observable
- Simplified mode exposes only complete flows
- No affordance exists without guaranteed resolution
- Returning users can always reconstruct what happened

---

**Status:** Capture Interaction Map v1 — Complete

---

## Contract Alignment

This interaction map is derived from and constrained by `UX_CONTRACTS.md`.

In particular, it enforces:
- G-1 No Dead Affordances
- G-2 No Invisible State Transitions
- M-1 Simplified Mode Contract
- I-2 Action Feedback Contract
- I-4 Empty State Contract
