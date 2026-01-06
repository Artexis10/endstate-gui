# UX PR Checklist

This checklist enforces `UX_CONTRACTS.md` and all interaction maps.

Any PR that affects UI, behavior, or user flows MUST satisfy this list.

---

## Global UX Contracts

- [ ] No visible affordance is inert (G-1)
- [ ] All state transitions are visible (G-2)
- [ ] Simplified mode exposes only complete flows (M-1)
- [ ] Mode differences are explicit and explainable (G-3, G-4)

---

## Action & Feedback

- [ ] Every user action produces immediate acknowledgment (I-2)
- [ ] Every action resolves visibly (success / failure / explanation)
- [ ] Returning users can reconstruct what happened

---

## Expand / Collapse & Empty States

- [ ] No expandable affordance reveals empty content (I-1)
- [ ] All empty states explain what’s happening (I-4)

---

## Disabled & Gated Behavior

- [ ] Disabled controls explain why they are disabled (I-3)
- [ ] Gated features are hidden or explained (V-1)
- [ ] No “advanced-only” affordance exists without explanation

---

## Mode Safety

- [ ] Simplified mode never exposes partial or technical actions
- [ ] Detailed mode does not alter primary behavior
- [ ] Mode switching produces visible change

---

## Surface-Specific Checks

- [ ] Capture behavior matches CAPTURE_INTERACTION_MAP.md
- [ ] Reports behavior matches REPORTS_INTERACTION_MAP.md
- [ ] Profiles behavior matches PROFILES_INTERACTION_MAP.md
- [ ] Navigation behavior matches GLOBAL_NAVIGATION_INTERACTION_MAP.md

---

## Final Assertion

- [ ] A non-technical user would never encounter a dead end
- [ ] No UX contract was violated or weakened

If any item fails, the PR must be revised or the contract explicitly updated.
