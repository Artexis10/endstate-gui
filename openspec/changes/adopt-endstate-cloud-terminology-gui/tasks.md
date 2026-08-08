## Tasks

### Task 1: Pane titles, toast, and the engine-incompatibility notice
**File**: `src/App.tsx`
- [x] Post-push toast reads `Pushed to Endstate Cloud.`
- [x] Both engine-incompatibility notices read `Endstate Cloud is not available with the bundled engine. Update Endstate to enable it.`
- [x] `getPageTitle()` returns `Endstate Cloud` for the `auth` and `backup` pages

### Task 2: Backup surfaces
- [x] `hosted-backup-chip.tsx`: five state strings renamed, and the header comment's quoted copy updated so it stays true
- [x] `hosted-backup-signed-out.tsx`: heading and description renamed; the `€4/month` literal left alone
- [x] `subscription-banner.tsx`: `active` title and the lowercase `none` title renamed; the contract citation in the header comment left alone
- [x] `backup-pane.tsx`: signed-out line renamed
- [x] `quota-meter.tsx`: `aria-label` renamed
- [x] `reauth-dialog.tsx`: both session-expired descriptions renamed

### Task 3: Auth surfaces
- [x] `hosted-backup-session-check.tsx`: checking and failed states renamed
- [x] `auth-pane.tsx`: sign-in description renamed

### Task 4: Flow CTAs
- [x] `save-flow.tsx`: push CTA renamed, and the prop comment quoting it updated
- [x] `setup-flow.tsx`: restore CTA text and its `aria-label` renamed

### Task 5: Error headlines
**File**: `src/lib/backup-errors.ts`
- [x] Five headlines renamed with codes, tones, bodies, and CTA actions unchanged

### Task 6: Scheduled auto-push honesty fix
**File**: `src/components/app/settings/continuous-protection-setting.tsx`
- [x] Description rewritten to describe re-uploading the last saved setup, to state that the drift found is not captured, and to direct the user to save again
- [x] Behaviour unchanged; the Continuous protection setting keeps its name

### Task 7: Documentation
**File**: `README.md`
- [x] Section renamed to `Endstate Cloud`, with a note that the capability key, the type, and the contract filename are deliberately unchanged
- [x] Quoted engine-gate copy updated to the new string

### Task 8: Tests
- [x] `src/components/ui/pill.test.tsx`: sample chip copy repinned
- [x] `src/components/app/backup/hosted-backup-chip.test.tsx`: signed-out assertion repinned
- [x] `src/components/app/backup/subscription-banner.test.tsx`: `active` case text repinned
- [x] `src/components/app/auth/hosted-backup-session-check.test.tsx`: both assertions repinned
- [x] `src/components/app/intent/setup-flow-restore-cta.test.tsx`: CTA assertion repinned

### Task 9: Keep the main specs in step
- [x] `auth-ui` delta: `Sign-in pane visibility gate` repinned to the new engine-incompatibility copy
- [x] `backup-pane` delta: `Subscription banner` repinned for the `active` and `none` states, and `Friendly engine-error rendering` repinned for the network-failure headline example — both pasted in full so archiving cannot drop scenarios

### Task 10: Verification
- [x] `npx tsc --noEmit`
- [x] `npm run lint`
- [x] `npm run test:unit`
- [x] `npm run test:coverage`
- [x] `npx vite build`
- [x] `npm run openspec:validate`
- [x] `npm run test:e2e`
- [x] Repo-wide grep for `Hosted Backup` / `hosted backup` with every survivor classified as a retained identifier, a contract-document citation, or historical text
