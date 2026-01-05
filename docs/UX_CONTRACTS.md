# Endstate UX Contracts — v1

## What a UX contract is (for Endstate)

A **UX contract** is a guarantee between the system and the user:

> “If the UI exposes an affordance, the user will always get feedback, state change, or explanation appropriate to their mode.”

If the contract cannot be upheld, the affordance must not exist.

---

## Global UX Invariants (Non-Negotiable)

These apply everywhere.

### G-1: No Dead Affordances

**Contract**

Any visible interactive element MUST:
- Perform an action, or
- Produce immediate explanatory feedback

**Disallowed**
- Clickable rows that expand to nothing
- Buttons that do nothing in Simplified mode
- Toggles that change internal state without user-visible confirmation

---

### G-2: No Invisible State Transitions

**Contract**

Every meaningful state transition MUST be observable via:
- Content change
- Status indicator
- Toast / message
- Disabled → enabled transition

**Disallowed**
- Background actions with no acknowledgment
- Mode-gated behavior without a visible reason

---

### G-3: Mode Must Never Break Discoverability

**Contract**

Simplified mode may:
- Hide advanced controls
- Collapse optional information

Simplified mode must NOT:
- Remove primary outcomes
- Remove confirmation of success/failure
- Leave interaction paths visually intact but functionally inert

---

### G-4: Affordance Consistency Across Modes

**Contract**

If an affordance exists in both modes:
- It must behave identically

If behavior differs:
- The affordance must be visibly different or absent

**Disallowed**
- Same control, different result, no explanation

---

## Mode Contract

### M-1: Simplified Mode Contract

**Promise to the user**
- “Everything you see will work”
- “Nothing you don’t need will distract you”

**Rules**
- Only outcome-oriented actions are exposed
- All interactions resolve visibly
- No partial affordances (e.g. expandable shells without content)

---

### M-2: Detailed Mode Contract

**Promise to the user**
- “You can see how and why things work”
- “You can access logs, files, internals, and metadata”

**Rules**
- May expose secondary actions
- May expose technical states
- Must still obey G-1 and G-2

---

## Interaction-Level Contracts

### I-1: Expand / Collapse Contract

**Contract**

Expanding an item MUST reveal:
- New information, or
- New actions, or
- A clear explanation why nothing more exists

**Mode behavior**
- Simplified: only primary summary + primary outcome
- Detailed: summary + internals + secondary actions

**Disallowed**
- Expandable affordance that reveals an empty region in Simplified mode

---

### I-2: Action Feedback Contract

**Contract**

Every action MUST produce:
- Immediate feedback (acknowledgment)
- Eventual resolution (success / failure / partial)

Resolution MUST be visible even if the user navigates away and returns.

---

### I-3: Disabled State Contract

**Contract**
- Disabled ≠ invisible
- Disabled controls MUST explain *why* they are disabled
- Disabled controls MUST indicate *what would enable them*

**Mode behavior**
- Simplified: short, outcome-focused explanation
- Detailed: may include technical reason

---

### I-4: Empty State Contract

**Contract**

Empty states MUST answer at least one:
- “Nothing to do yet”
- “Action required”
- “Feature unavailable in this mode”

**Disallowed**
- Blank panels
- Empty lists without explanation

---

### I-5: Status Representation Contract

**Contract**

System state MUST be legible without reading logs.

Status must be expressed in:
- Plain language
- Stable semantic categories (success / warning / attention / failure)

**Mode behavior**
- Simplified: single dominant state
- Detailed: may show sub-states

---

## Visibility & Gating Contracts

### V-1: Gated Features Must Not Tease

**Contract**

If a feature is gated by mode:
- The affordance is either:
  - Hidden, or
  - Replaced with a clear explanation

**Disallowed**
- Visible buttons that do nothing in Simplified mode
- “Advanced only” behavior without explanation

---

### V-2: Progressive Disclosure Only

**Contract**
- Complexity may increase with interaction
- Complexity may NOT appear suddenly without user intent

---

## Error & Recovery Contracts

### E-1: Errors Are First-Class States

**Contract**

Errors MUST:
- Explain what failed
- Indicate whether the system is safe
- Indicate next steps

**Mode behavior**
- Simplified: reassurance + next action
- Detailed: cause + context + links

---

### E-2: Recovery Must Be Obvious

**Contract**
- If the system can recover, the path must be visible
- If it cannot, the system must say so explicitly

---

## What This Enables Later

These contracts allow you to later build:
- Interaction tests without DOM coupling
- UX regression detection (“this breaks G-1”)
- Clear review criteria for PRs
- A clean interaction map layer on top
