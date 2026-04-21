## Why

The current `NoProfilePrompt` enforces a linear Capture → Setup → Verify sequence. This is wrong for users arriving on a new machine with an existing profile — they have no reason to capture first. There are two distinct user journeys that need separate entry points.

## What Changes

- Replace `NoProfilePrompt` (linear stepper) with `FlowSelector` (side-by-side dual entry)
- Remove step numbers and lock icons from `ActionCard`
- Add `activeFlow` state to `use-overview-state.ts`
- When a profile is selected, FlowSelector unmounts and normal action cards appear

## Capabilities

### New Capabilities
- Users can enter "Set up this machine" flow directly without capturing first
- Split-screen entry presents both flows as equal peers

### Modified Capabilities
- Action cards no longer display step numbers or lock icons
- No-profile state shows FlowSelector instead of stepper

## Impact

- **Deleted**: `no-profile-prompt.tsx`
- **Created**: `flow-selector.tsx`
- **Modified**: `overview-screen.tsx`, `action-card.tsx`, `use-overview-state.ts`, `types.ts`
- **No engine/CLI changes** — purely presentation layer
- **No contract changes** — same props, same data flow from App.tsx
