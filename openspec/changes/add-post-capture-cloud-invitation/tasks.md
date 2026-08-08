## Tasks

### Task 1: Settings persistence
**File**: `src/settings.ts`
- [x] `cloudInvitationShownAt: string | null` (default `null`) and `cloudInvitationDismissed: boolean` (default `false`) on `AppSettings`, documented against the `autoBackupPromptSeen` one-time precedent
- [x] Both fields added to all three explicit `AppSettings` literals in `loadSettingsWithProfileMigration`, so no migration path resets them
- [x] Persisted through the existing namespaced `src/lib/storage.ts` owner — no new key, no new storage mechanism

### Task 2: Eligibility gate
**File**: `src/components/app/intent/save-flow.tsx`
- [x] Pure `isCloudInvitationEligible` covering: not previously shown, not dismissed, not an active subscriber (`hostedBackupSupported && signedIn && subscriptionStatus === 'active'`), and auto-backup consent neither open nor pending
- [x] Restricted to the `phase === 'saved'` transition, so a failed, cancelled, or unsaved capture can never reach it
- [x] `useRef` session latch so "Save another copy" cannot re-present it before the parent's persistence propagates

### Task 3: Record before present
**File**: `src/components/app/intent/save-flow.tsx`
- [x] `onCloudInvitationShown` fired synchronously in the save-success path, ahead of every state update that could render the card
- [x] Card visibility driven by the session latch rather than the persisted flag (which is non-null by the time the card renders)

### Task 4: Invitation card
**File**: `src/components/app/intent/save-flow.tsx`
- [x] Built from `ui/card.tsx`, following the `subscription-banner.tsx` BannerShell tone pattern inline (not extracted — see the `quota-notice.tsx` comment)
- [x] `role="status"`, `aria-live="polite"`, `data-testid="save-flow-cloud-invitation"`
- [x] Actions use `ui/button.tsx` (focus-visible ring from the primitive; native `button` is forbidden outside `src/components/ui/**`)
- [x] Reduced-motion respected via the existing `prefersReducedMotion()`-derived transition
- [x] Exact copy, no price

### Task 5: Single settings count
**File**: `src/components/app/intent/save-flow.tsx`
- [x] Scan-complete headline switched from `result.configsIncluded.length` to `settingsCount`, with the rationale recorded at the call site

### Task 6: App wiring
**File**: `src/App.tsx`
- [x] Persisted flags passed to `SaveFlow`
- [x] `autoBackupConsentPending` derived from the dialog's open state plus the same condition that opens it
- [x] `onCloudInvitationShown` / `onCloudInvitationDismissed` persisting via the existing `updateSettings` helper
- [x] Primary action reuses the existing `handleNavigate('backup')` route — no external checkout

### Task 7: Tests
- [x] `src/components/app/intent/save-flow-cloud-invitation.test.tsx`: one case per eligibility condition, record-before-present ordering, dismissal permanence, copy and count pinning
- [x] `src/settings.test.ts`: defaults, round-trip, legacy-blob defaulting, migration preservation on both legacy paths
- [x] `e2e/cloud-invitation.spec.ts`: appears once, absent after reload — both answered and unanswered
- [x] Existing full `AppSettings` literals in test fixtures updated with the new fields

### Task 8: Verification
- [x] `npx tsc --noEmit`
- [x] `npm run lint`
- [x] `npm run test:unit`
- [x] `npx vite build`
- [x] `npm run openspec:validate`
- [x] `npm run test:e2e`
