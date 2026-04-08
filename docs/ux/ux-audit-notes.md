# UX Audit Notes

This document records known UX risk patterns identified via audit.
They do not imply required changes unless a surface is modified.

Audit source: Claude Opus
Date: YYYY-MM-DD










# UX Architecture Risk Audit

## Critical Finding: Missing Specification

`docs/ux/GLOBAL_NAVIGATION_INTERACTION_MAP.md` is **empty**. This is a structural gap—navigation behavior is undefined, yet all three surface maps assume users can "leave and return" with state preserved. This creates unspecified cross-surface transition behavior.

---

## Risk 1: Capture State Lost on Navigation

**Risk:** User initiates capture (E2), navigates away, returns to find UI in E1 (Idle) with no indication capture ever ran or is still running.

**Contract violated:** 
- **I-2 Action Feedback Contract** — "Resolution MUST be visible even if the user navigates away and returns"
- **G-2 No Invisible State Transitions**

**Why this might occur:** 
- Navigation resets component state
- Capture status is stored only in component-local state, not persisted
- No global state subscription for in-progress operations

**Verification required:**
- Confirm capture state survives navigation round-trip
- Confirm E2/E3/E4/E5 states are reconstructable from persisted state
- Confirm navigation does not unmount capture surface in a way that loses resolution

---

## Risk 2: Report Expand Reveals Empty Content in Simplified Mode

**Risk:** Report row is expandable, but expansion reveals nothing meaningful—empty panel or only technical metadata hidden in Simplified mode.

**Contract violated:**
- **I-1 Expand / Collapse Contract** — "Expandable affordance that reveals an empty region in Simplified mode" is explicitly disallowed
- **G-1 No Dead Affordances**

**Why this might occur:**
- Report data model has optional fields; some reports have no user-facing summary
- Simplified mode filters out all available content, leaving nothing
- Expand affordance is rendered unconditionally regardless of content availability

**Verification required:**
- Confirm expand affordance is hidden when no Simplified-appropriate content exists
- Confirm fallback explanation is rendered if expansion would otherwise be empty
- Audit report data model for required vs optional fields

---

## Risk 3: Profile Selection Without Visible Confirmation

**Risk:** User selects a profile, selection is stored, but UI provides no visible confirmation—active profile indicator does not update or is ambiguous.

**Contract violated:**
- **G-2 No Invisible State Transitions**
- **I-2 Action Feedback Contract**

**Why this might occur:**
- Selection updates backend state but UI re-render is not triggered
- Active profile indicator relies on stale local state
- Race condition between selection and indicator update

**Verification required:**
- Confirm selection produces immediate visual acknowledgment
- Confirm active profile indicator is derived from authoritative state source
- Confirm no async gap between action and feedback

---

## Risk 4: Disabled Profile Actions Without Explanation

**Risk:** Profile management actions (delete, rename) are disabled but provide no explanation why.

**Contract violated:**
- **I-3 Disabled State Contract** — "Disabled controls MUST explain *why* they are disabled"

**Why this might occur:**
- Disabled state is set based on business logic, but tooltip/explanation is not implemented
- Default profile cannot be deleted, but this is not communicated
- Mode-gated actions are disabled without visible reason

**Verification required:**
- Confirm every disabled control has an associated explanation
- Confirm explanation is mode-appropriate (Simplified: outcome-focused; Detailed: technical)
- Audit all conditions that disable profile actions

---

## Risk 5: Capture Failure Shows Generic Error

**Risk:** Capture fails, UI shows "Something went wrong" without indicating what failed, whether system is safe, or what to do next.

**Contract violated:**
- **E-1 Errors Are First-Class States**
- **E-2 Recovery Must Be Obvious**

**Why this might occur:**
- Error handling catches all exceptions with single generic message
- Backend returns error codes without user-facing messages
- Simplified mode strips error detail without providing reassurance

**Verification required:**
- Confirm error states include: what failed, system safety, next steps
- Confirm Simplified mode provides reassurance + action, not just truncated detail
- Audit error message generation for all capture failure paths

---

## Risk 6: Mode Switch Creates Dead Affordances

**Risk:** User is in Detailed mode viewing expanded report with secondary actions. User switches to Simplified mode. Actions remain visible but become inert.

**Contract violated:**
- **G-4 Affordance Consistency Across Modes** — "Same control, different result, no explanation" is disallowed
- **V-1 Gated Features Must Not Tease**
- **G-1 No Dead Affordances**

**Why this might occur:**
- Mode switch does not trigger re-render of expanded content
- Action visibility is computed at expand time, not reactively
- Detailed-only actions remain in DOM but handlers are mode-gated

**Verification required:**
- Confirm mode switch triggers re-evaluation of all visible affordances
- Confirm Detailed-only actions are hidden (not disabled) in Simplified mode
- Confirm expanded state is either collapsed or re-rendered on mode switch

---

## Risk 7: Reports List Appears Empty Without Explanation

**Risk:** User navigates to Reports, no reports exist, UI shows blank list or empty table with no explanation.

**Contract violated:**
- **I-4 Empty State Contract** — "Blank panels" and "Empty lists without explanation" are disallowed

**Why this might occur:**
- Empty state component is not implemented
- Conditional rendering shows list container even when list is empty
- Loading state completes but empty state is not triggered

**Verification required:**
- Confirm E1 (No Reports Exist) renders explicit empty state
- Confirm empty state explains what reports are and how to create them
- Audit all list/table components for empty state handling

---

## Risk 8: Capture Completion Without Clarity on Next Steps

**Risk:** Capture completes successfully (E3/E4), user sees "Success" but has no indication whether further action is required or what to do next.

**Contract violated:**
- **Flow C** in Capture map: "Success without clarity on next steps" is forbidden

**Why this might occur:**
- Success state shows only status, not guidance
- E3 (Uncommitted) vs E4 (Committed) distinction is not visually clear
- Post-capture workflow is not communicated

**Verification required:**
- Confirm E3 explicitly indicates further action is required (if applicable)
- Confirm E4 explicitly indicates no further action is required
- Confirm success state includes next-step guidance

---

## Risk 9: Profile Purpose Not Understandable

**Risk:** Profile list shows profile names but no indication of what each profile does. User cannot make informed selection.

**Contract violated:**
- **Flow C** in Profiles map: "Profiles that require guessing" is forbidden
- **I-4 Empty State Contract** (conceptually—profile metadata is empty)

**Why this might occur:**
- Profile data model has optional description field that is often empty
- Profile names are technical/internal identifiers
- Simplified mode hides configuration but provides no summary

**Verification required:**
- Confirm every profile communicates purpose at high level
- Confirm profile data model requires or derives human-readable purpose
- Audit profile creation flow to ensure purpose is captured

---

## Risk 10: Cross-Surface State Inconsistency

**Risk:** User selects profile in Profiles surface, navigates to Capture, but Capture surface shows different/stale active profile.

**Contract violated:**
- **G-2 No Invisible State Transitions**
- **Flow E** in Profiles map: "Active profile changing invisibly" is forbidden

**Why this might occur:**
- Surfaces maintain independent state subscriptions
- Profile selection is not propagated to global state
- Capture surface caches profile at mount time

**Verification required:**
- Confirm active profile is single source of truth across all surfaces
- Confirm navigation does not introduce stale state
- Confirm profile change triggers re-evaluation in dependent surfaces

---

## Risk 11: Navigation Undefined — All "Leave and Return" Flows Are Unverifiable

**Risk:** All three interaction maps define "Flow E — Leave and Return" with specific guarantees, but [GLOBAL_NAVIGATION_INTERACTION_MAP.md](docs/ux/GLOBAL_NAVIGATION_INTERACTION_MAP.md) is empty. There is no specification for how navigation preserves or restores state.

**Contract violated:**
- **I-2 Action Feedback Contract** — persistent resolution requirement
- All Flow E definitions in Capture, Reports, Profiles maps

**Why this might occur:**
- Navigation was deferred as "obvious" but never specified
- Each surface assumes navigation works correctly without defining the contract
- No shared state management specification exists

**Verification required:**
- **GLOBAL_NAVIGATION_INTERACTION_MAP.md must be completed** before any surface map can be validated
- Navigation must define: state persistence, restoration, cross-surface consistency
- All Flow E guarantees must be traceable to navigation specification

---

## Risk 12: Spinner Without Explanation During Capture

**Risk:** Capture in progress (E2) shows spinner but no text explaining what is happening.

**Contract violated:**
- **Flow B** in Capture map: "Spinner without explanation" is forbidden

**Why this might occur:**
- Loading component is generic and does not accept context
- Capture progress messages are not surfaced to UI
- Simplified mode hides progress detail without providing summary

**Verification required:**
- Confirm E2 state includes explanatory text, not just spinner
- Confirm Simplified mode shows "single dominant 'in progress' signal" with explanation
- Audit loading/spinner components for context support

---

## Risk 13: Report Status Requires Log Interpretation

**Risk:** Report shows status like "Exit code 1" or "Process terminated" without translating to success/warning/failure.

**Contract violated:**
- **I-5 Status Representation Contract** — "System state MUST be legible without reading logs"
- **Flow C** in Reports map: "Outcome visible only via technical detail" is forbidden

**Why this might occur:**
- Status is passed through from backend without transformation
- Status mapping to semantic categories is incomplete
- Edge cases (partial success, warnings) are not handled

**Verification required:**
- Confirm all possible statuses map to semantic categories
- Confirm status display uses plain language, not technical codes
- Audit status transformation layer for completeness

---

## Risk 14: Destructive Profile Action Exposed in Simplified Mode

**Risk:** Delete profile action is visible in Simplified mode, violating the guarantee that only safe, non-destructive actions are exposed.

**Contract violated:**
- **M-1 Simplified Mode Contract** — "Only outcome-oriented actions are exposed"
- **Flow D** in Profiles map: "Simplified: only safe, non-destructive actions exposed"

**Why this might occur:**
- Action visibility is not mode-gated
- "Destructive" classification is not defined in data model
- Simplified mode filtering is incomplete

**Verification required:**
- Confirm destructive actions are hidden (not disabled) in Simplified mode
- Confirm action classification (safe vs destructive) is explicit
- Audit all profile management actions for mode-appropriate visibility

---

## Summary

| Risk | Severity | Primary Contract | Surface |
|------|----------|------------------|---------|
| 11 - Navigation undefined | **BLOCKING** | I-2, all Flow E | Global |
| 1 - Capture state lost | High | I-2, G-2 | Capture |
| 6 - Mode switch dead affordances | High | G-4, V-1, G-1 | All |
| 2 - Empty expand in Simplified | High | I-1, G-1 | Reports |
| 5 - Generic capture error | High | E-1, E-2 | Capture |
| 10 - Cross-surface state inconsistency | High | G-2 | Profiles/Capture |
| 3 - Profile selection no confirmation | Medium | G-2, I-2 | Profiles |
| 4 - Disabled without explanation | Medium | I-3 | Profiles |
| 7 - Empty reports list | Medium | I-4 | Reports |
| 8 - Success without next steps | Medium | Flow C | Capture |
| 9 - Profile purpose unclear | Medium | Flow C | Profiles |
| 12 - Spinner without explanation | Medium | Flow B | Capture |
| 13 - Status requires log reading | Medium | I-5 | Reports |
| 14 - Destructive action in Simplified | Medium | M-1 | Profiles |

---

**Audit complete.** Risk 11 (empty [GLOBAL_NAVIGATION_INTERACTION_MAP.md](docs/ux/GLOBAL_NAVIGATION_INTERACTION_MAP.md)) is a blocking gap—all "leave and return" guarantees are unverifiable until navigation behavior is specified.

Audit complete. 

**14 risks identified** across the UX specifications. The most critical finding: [GLOBAL_NAVIGATION_INTERACTION_MAP.md](docs/ux/GLOBAL_NAVIGATION_INTERACTION_MAP.md) is empty, which makes all "leave and return" guarantees in the three surface maps unverifiable.

Key high-severity risks:
- **State loss on navigation** (Capture, Profiles)
- **Mode switch creating dead affordances** (all surfaces)
- **Empty expand regions in Simplified mode** (Reports)
- **Generic error messages** (Capture)
- **Cross-surface state inconsistency** (Profiles → Capture)

The summary table at the end ranks all risks by severity and maps each to the specific contract it would violate.