## 1. Create OpenSpec change artifacts

- [x] 1.1 Create `openspec/changes/flow-selector-dual-entry/` with `.openspec.yaml`, `proposal.md`, `specs/`, `tasks.md`

## 2. Create FlowSelector component

- [x] 2.1 Create `src/components/app/overview/components/flow-selector.tsx` with split view layout
- [x] 2.2 Implement expanded capture state (left panel full width, back button)
- [x] 2.3 Implement expanded setup state with profile selector (when profiles exist)
- [x] 2.4 Implement expanded setup empty state (when no profiles exist) with escape hatches
- [x] 2.5 Add animations using existing `src/lib/motion.ts` system with reduced-motion support

## 3. Modify existing components

- [x] 3.1 Remove `stepNumber` prop and lock icon from `action-card.tsx`
- [x] 3.2 Update `overview-screen.tsx` conditional rendering to use FlowSelector
- [x] 3.3 Add `activeFlow` state to `use-overview-state.ts`
- [x] 3.4 Update `isCardDisabled` logic — all cards enabled when profile is selected
- [x] 3.5 Delete `no-profile-prompt.tsx` and update barrel export

## 4. Verification

- [x] 4.1 App compiles with no TypeScript errors
- [x] 4.2 All 732 existing tests pass
- [x] 4.3 Test updated: FlowSelector shown instead of disabled cards when no profile
- [ ] 4.4 Both flows work visually in the browser
- [ ] 4.5 Animations respect `prefers-reduced-motion`
- [ ] 4.6 Responsive: panels stack vertically on small screens
