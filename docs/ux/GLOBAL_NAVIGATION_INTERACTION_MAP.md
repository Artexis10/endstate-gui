# Global Navigation & Mode Switching Interaction Map — v1

**Source of truth:** UX_CONTRACTS.md  
**Surface:** Global Navigation & Mode Switching  
**Applies to:** Simplified and Detailed modes  
**Purpose:** Ensure navigation and mode switching never create invisible state or dead affordances

---

## Contract Alignment

This interaction map enforces:
- G-1 No Dead Affordances
- G-2 No Invisible State Transitions
- G-3 Mode Must Never Break Discoverability
- G-4 Affordance Consistency Across Modes
- M-1 Simplified Mode Contract
- M-2 Detailed Mode Contract
- I-2 Action Feedback Contract

---

## Surface Definition

**User mental model:**  
“I want to move around the app and understand what mode I am in at all times.”

Navigation defines **context**, not action.

---

## Entry States

### E1 — App Loaded
- User enters the application

**Guaranteed visibility**
- Current surface is obvious
- Current mode is explicit

---

### E2 — Navigating Between Surfaces
- User switches between Capture, Reports, Profiles, etc.

**Guaranteed visibility**
- Navigation results in an immediate, visible context change
- No navigation action is inert

---

### E3 — Mode Switching
- User switches between Simplified and Detailed modes

**Guaranteed visibility**
- Mode change is explicit
- User understands what changed

---

## Primary User Intents

1. Navigate between major surfaces
2. Understand where they are
3. Understand which mode is active
4. Switch modes safely
5. Never feel “lost”

---

## Core Interaction Flows

### Flow A — Navigating Between Surfaces

**Intent:** Change context

1. User selects a navigation item
2. System immediately acknowledges navigation
3. Surface content updates visibly

**Must satisfy**
- G-1 No Dead Affordances
- G-2 No Invisible State Transitions

**Forbidden**
- Navigation items that do nothing
- Delayed or invisible navigation

---

### Flow B — Understanding Current Location

**Intent:** Stay oriented

At all times:
- Current surface must be identifiable
- User must not infer location from content alone

**Forbidden**
- Ambiguous navigation state
- Multiple surfaces appearing active

---

### Flow C — Switching Modes

**Intent:** Change level of detail

1. User initiates mode switch
2. System acknowledges mode change immediately
3. UI updates to reflect new mode

**Guaranteed**
- Mode change is explicit
- Resulting behavior matches mode contract

**Forbidden**
- Mode switching with no visible effect
- Partial mode application

---

### Flow D — Mode Effects on Navigation

**Intent:** Avoid confusion

When mode changes:
- Primary navigation remains stable
- Only secondary or advanced affordances may change

**Forbidden**
- Navigation items that appear but do nothing
- Navigation affordances that behave differently without explanation

---

## Mode Differences

### Simplified Mode

**Guarantees**
- Navigation exposes only complete, safe surfaces
- No navigation item leads to partial functionality

**Never**
- Show navigation to advanced-only surfaces
- Expose inert navigation affordances

---

### Detailed Mode

**Guarantees**
- Same primary navigation as Simplified
- Additional surfaces or sections allowed

**Must still obey**
- G-1 No Dead Affordances
- G-2 No Invisible State Transitions

---

## Forbidden States (Contract Violations)

These states must never exist:

- Navigation items that do nothing in Simplified mode
- Mode switch that produces no visible change
- Surfaces that appear accessible but are incomplete
- Mode-dependent behavior without explanation
- Loss of orientation after navigation

---

## Validation Checklist

This interaction map is valid only if all are true:

- Current surface is always identifiable
- Current mode is always explicit
- Navigation actions always resolve visibly
- Mode switching never breaks discoverability
- Users never need to “guess” where they are

---

**Status:** Global Navigation Interaction Map v1 — Complete
