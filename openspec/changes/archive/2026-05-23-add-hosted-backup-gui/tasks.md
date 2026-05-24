## 1. OpenSpec scaffold

- [x] 1.1 Create `openspec/changes/add-hosted-backup-gui/` with `proposal.md`, `design.md`, `tasks.md`, and three `specs/` subdirs
- [x] 1.2 Validate with `openspec validate add-hosted-backup-gui --strict`

## 2. Type extensions and Rust stdin

- [ ] 2.1 Extend `EnginePhase` in `src/lib/streaming-events.ts` with `'backup-push' | 'backup-pull'`
- [ ] 2.2 Add `BackupChunkStatus` union and `BackupChunkEvent` interface to `src/lib/streaming-events.ts`
- [ ] 2.3 Add `isBackupChunkEvent` type guard
- [ ] 2.4 Add `BackupChunkEvent` to `StreamingEvent` union
- [ ] 2.5 Extend `EndstateCapabilitiesData.features` in `src/types.ts` with `hostedBackup?: { supported, minSchemaVersion, issuerUrl, audience }`
- [ ] 2.6 Add per-command response data interfaces to `src/types.ts` (`BackupSignupData`, `BackupLoginData`, `BackupStatusData`, `BackupListData`, `BackupVersionsData`, `BackupPushData`, `BackupPullData`, `BackupDeleteData`, `BackupRecoverData`, `AccountDeleteData`)
- [x] 2.7 Add stdin support to `src-tauri/src/engine_adapter.rs` (minimal — pipe and close in `run_engine`)
- [x] 2.8 Extend `engine_run` Tauri command in `src-tauri/src/lib.rs` with `stdin_input: Option<String>`
- [ ] 2.9 (Skipped — existing `delete_file_silent` Tauri command at `lib.rs:276` is reused for recovery-key-dialog cleanup; no new command needed)
- [ ] 2.10 `cargo check` clean

## 3. CLI bridge wrappers

- [ ] 3.1 Add `backupSignup`, `backupLogin`, `backupRecover` (stdin commands) to `src/cli-bridge.ts`
- [ ] 3.2 Add `backupLogout`, `backupStatus`, `backupList`, `backupVersions` (no stdin)
- [ ] 3.3 Add `backupPush`, `backupPull` (streaming via existing streaming-runner)
- [ ] 3.4 Add `backupDelete`, `backupDeleteVersion` (auto-pass `--confirm`)
- [ ] 3.5 Add `accountDelete` (auto-pass `--confirm`)
- [ ] 3.6 Each wrapper validates envelope and throws `CliCommandError` on `success: false`

## 4. Auth pane (Phase 3)

- [ ] 4.1 Add `'auth'` to `PageType` in `src/App.tsx`
- [ ] 4.2 Create `src/components/app/auth/auth-pane.tsx` (three-tab shell)
- [ ] 4.3 Create `sign-in-form.tsx` (email + passphrase, calls `backupLogin`)
- [ ] 4.4 Create `sign-up-form.tsx` (email + passphrase + confirm, kicks off recovery-key dialog)
- [ ] 4.5 Create `recover-form.tsx` (email + 24-word mnemonic + new passphrase, calls `backupRecover`)
- [ ] 4.6 Create `use-auth-state.ts` hook
- [ ] 4.7 Wire route gate in `App.tsx`: signed-out → 'auth', signed-in → existing flows + backup entry

## 5. Recovery key dialog (Phase 4 — load-bearing)

- [ ] 5.1 `npm install jspdf`
- [ ] 5.2 Create `src/components/app/auth/recovery-key-dialog.tsx`
- [ ] 5.3 4×6 numbered word grid via `<dl>`
- [ ] 5.4 Save-to-file: Tauri `save()` dialog → `writeTextFile` newline-separated
- [ ] 5.5 Save-as-PDF: jspdf single-page with words + date + minimal copy
- [ ] 5.6 Copy-to-clipboard: `navigator.clipboard.writeText`
- [ ] 5.7 Track per-method `saved` state; enable Continue when ≥ 2 saved
- [ ] 5.8 Block Escape, pointer-down-outside, no close button
- [ ] 5.9 On Continue: `delete_temp_file` invoke, transition to backup pane

## 6. Backup pane (Phase 5)

- [ ] 6.1 Add `'backup'` to `PageType`
- [ ] 6.2 Create `src/components/app/backup/backup-pane.tsx`
- [ ] 6.3 Create `subscription-banner.tsx` (4 states: active/grace/cancelled/none) with hardcoded URLs
- [ ] 6.4 Create `backup-list.tsx`
- [ ] 6.5 Create `version-list.tsx` with per-version dropdown actions
- [ ] 6.6 Create `push-progress-dialog.tsx` (consumes `backup-chunk` events)
- [ ] 6.7 Create `pull-progress-dialog.tsx` (downloading → verified → decrypted sub-phases)
- [ ] 6.8 Create `delete-confirmation-modal.tsx` (reused for backup + version delete)
- [ ] 6.9 Wire cancel buttons to `engine_cancel` with calm toast
- [ ] 6.10 Subscription gating: write disabled in grace/cancelled/none; delete allowed in any non-none
- [x] 6.11 Wire Subscribe/Renew to `backup subscribe` (engine ≥ v2.1.0): open returned `checkoutUrl`, route `AUTH_REQUIRED` to `onAuthLost`, guard double-mint (supersedes hardcoded URL in 6.3)

## 7. Restore-on-new-machine wizard (Phase 6)

- [ ] 7.1 Create `src/components/app/backup/restore-wizard.tsx`
- [ ] 7.2 Detection: post-sign-in, if `lastBackupAt` set and zero local profiles → show wizard
- [ ] 7.3 Three steps: choose backup/version → choose destination → progress
- [ ] 7.4 Success summary with "Open folder" (existing `openFolder` Tauri pattern)

## 8. Account settings (Phase 7)

- [ ] 8.1 Extend existing `case 'settings'` block in `App.tsx`
- [ ] 8.2 Create `src/components/app/account/account-section.tsx` (email, subscription pill with Manage link, Sign out)
- [ ] 8.3 Create `account-delete-modal.tsx`: email-match validation gate before Confirm enables
- [ ] 8.4 Sign-out: `backupLogout` → toast → route to 'auth'
- [ ] 8.5 Delete: `accountDelete` → toast → goodbye/unsigned state

## 9. Engine compatibility gate (Phase 8)

- [ ] 9.1 In `App.tsx` boot, check `capabilities.features.hostedBackup?.supported`
- [ ] 9.2 If false: hide auth pane, backup entry, account section
- [ ] 9.3 Show neutral banner "Update Endstate to enable Hosted Backup"

## 10. Tests (Phase 9)

- [ ] 10.1 Unit: sign-up form validation (email regex, passphrase length, confirm match)
- [ ] 10.2 Unit: recovery dialog 2-of-3 enforcement; cannot dismiss; deletes temp file
- [ ] 10.3 Unit: PDF save method generates non-empty PDF containing 24 words
- [ ] 10.4 Unit: file save writes 24 words newline-separated
- [ ] 10.5 Unit: clipboard save passes 24 words to `writeText`
- [ ] 10.6 Unit: sign-in calls `backupLogin` with stdin lines
- [ ] 10.7 Unit: push subscribes to `backup-chunk` events and renders progress
- [ ] 10.8 Unit: pull renders three sub-phases
- [ ] 10.9 Unit: subscription banner table-driven test (4 states)
- [ ] 10.10 Unit: account-delete modal — Confirm disabled until typed email matches `status.email`
- [ ] 10.11 Unit: hostedBackup unsupported → all hosted-backup UI hidden
- [ ] 10.12 Unit: type-guard tests for `isBackupChunkEvent`
- [ ] 10.13 E2E: signup → recovery-key dialog (mocked engine deterministic mnemonic) → 2 saves → backup pane
- [x] 10.14 Unit: subscription banner onCheckout / onManage / checkoutPending wiring (extends 10.9)
- [x] 10.15 E2E: backup subscribe wiring — Subscribe + Renew open returned checkoutUrl; AUTH_REQUIRED → onAuthLost; double-mint guard (`e2e/backup-subscribe.spec.ts`, first backup-pane e2e in the repo — sets the harness pattern)

## 11. Verification

- [ ] 11.1 `npx tsc --noEmit` clean
- [ ] 11.2 `cd src-tauri && cargo check` clean
- [ ] 11.3 `npm run openspec:validate -- --all --strict --no-interactive` passes
- [ ] 11.4 `npx vitest run` — full suite passes (no regression of existing 733+ tests)
- [ ] 11.5 `npm run test:contract` passes
- [ ] 11.6 `npm run test:e2e` passes
- [ ] 11.7 `cd src-tauri && cargo test` passes
- [ ] 11.8 Manual smoke test (post-PR, against production substrate): full 14-step plan from PROMPT_4 PLUS explicit recovery-flow step — after cross-machine sign-in succeeds, clear keychain, run the forgot-passphrase flow with the saved 24-word mnemonic, set a new passphrase, verify the account is accessible with the new passphrase, then verify the old passphrase no longer works (negative test). Both cross-machine login AND cross-machine recovery are contractually load-bearing paths.

## 12. Documentation and PR

- [ ] 12.1 Update `README.md` with new GUI flows
- [ ] 12.2 Single commit, single PR
- [ ] 12.3 PR body: link contract §§1, 5, 6, 10, 12; flag `engine_adapter.rs` stdin edit as user-authorised exception per AI_CONTRACT.md
