## 1. Reconcile The Shipped Import Contract

- [x] 1.1 Sync both shipped `fix-capture-save-import-flow` deltas into canonical `capture-artifact-flow` and `final-state-from-envelope` without marking its unverified release checklist complete or archiving it.
- [x] 1.2 Add a formal removal/replacement delta for automatic import activation and move the connected regression contract under `capture-artifact-flow`.
- [x] 1.3 Before either change is archived, independently verify the older hotfix's outstanding tasks and archive it first with `openspec archive fix-capture-save-import-flow --skip-specs` so duplicate synced requirements are not reapplied and archive order cannot restore automatic preview.

## 2. Lock Current Regressions With Failing Tests

- [x] 2.1 Add component tests proving Capture labels installable inventory, captured settings, the settings icon, and settings-only entries with explicit installer ownership language.
- [x] 2.2 Replace imported-profile auto-preview expectations with failing tests for exact-card highlighting, the **Imported** badge, no preview before **Review setup**, exactly one explicit preview, and preview failure remaining separate from import success.
- [x] 2.3 Add failing lifecycle tests proving recent-import emphasis moves to a later import and clears on explicit review, deletion, or flow reset without starting a latent preview.
- [x] 2.4 Add failing Setup tests proving install-only preview shows one settings-off summary, hides per-module restore-disabled resolutions, and resets restore consent on profile changes.
- [x] 2.5 Add failing Setup tests proving every restore-intent change requests a fresh matching preview, blocks Apply while pending, rejects stale results including same-key older generations, resets module/target state, and preserves compatible application selections.
- [x] 2.6 Add failing browser and native drag tests covering accepted and unsupported enter/over/leave/cancel/drop/unmount states, Tauri v2 detection via `__TAURI_INTERNALS__`, landing-page visibility, busy rejection, and ordered exactly-once multi-file import.

## 3. Separate Import From Explicit Review

- [x] 3.1 Replace the pending-import-preview promise handoff with exact-path recently-imported state whose success boundary is transactional commit plus discovery.
- [x] 3.2 Keep Setup in browse state after import, focus or scroll the exact imported card into view, and add the one-shot **Imported** treatment and **Review setup** action using the existing card design.
- [x] 3.3 Route **Review setup** through the normal install-only preview path exactly once, clear recent-import state at every specified lifecycle boundary, and present later preview failures only on the setup surface.

## 4. Make Settings Ownership And Intent Truthful

- [x] 4.1 Update SaveFlow result labels, main-inventory explanation, settings legend, and settings-only explanation without changing its card layout, status colors, or engine-derived counts.
- [x] 4.2 Update Setup's settings-only heading and explanation so entries cannot be mistaken for applications the profile can install.
- [x] 4.3 Extend the preview callback with restore-intent options and map them only to the existing install-only or `--enable-restore` dry-run arguments.
- [x] 4.4 Associate every preview with profile, restore intent, and a monotonic request generation; show pending compatibility state, suppress all mismatched results, and keep Apply disabled until the active preview completes.
- [x] 4.5 Run a fresh preview for both directions of restore-intent change, never resurrect an earlier invocation result, and keep general preview errors available without leaking stale config rows.
- [x] 4.6 Render the single settings-available-but-off callout for install-only preview, and render engine-authored config resolutions, `restoreModulesAvailable[].displayName` module approval, and target mappings only from the matching restore-enabled preview.
- [x] 4.7 Reconcile application picker selections by stable engine-provided IDs across intent previews while clearing module approvals and target mappings whenever their source preview changes.

## 5. Unify Drag Feedback And Import Ownership

- [x] 5.1 Move native drag lifecycle ownership to App using the shared Tauri runtime detector, supported-path filtering, monotonic visual state cleanup, and the existing import coordinator lease.
- [x] 5.2 Drive DropZone's existing animation from controlled native state, retain browser HTML5 behavior, and show the same lightweight acceptance treatment when DropZone is not mounted.
- [x] 5.3 Process every supported dropped file once in supplied order, leave the most recently committed profile emphasized, remove DropZone's duplicate native listener/private runtime detector, and clear state on leave, cancel, drop, reject, reset, and unmount.

## 6. Protect The Connected Journey

- [ ] 6.1 Update the semantic Playwright journey to assert zero preview calls after ZIP import, click **Review setup**, and verify install-only then restore-enabled preview arguments.
- [ ] 6.2 Complete that journey by selecting a settings module, issuing live Apply with `--enable-restore --restore-filter`, asserting the semantic restore journal, and completing undo dry-run plus live revert.
- [ ] 6.3 Add a Playwright `DataTransfer` hover/drop scenario that observes acceptance before drop, cleared state after leave/drop, and one import per supported file in order.
- [ ] 6.4 Keep the mocked PR journey free of real winget/settings mutation and confirm the existing Windows gate audits MSI and NSIS plus smoke-tests the packaged engine without adding dependencies or lockfile churn.

## 7. Verification And Delivery

- [ ] 7.1 Run the focused Vitest files while implementing each red/green slice, then run `npm run test:unit`, `npm run lint`, and `npm run build`.
- [ ] 7.2 Run the focused `e2e/capture-artifact-flow.spec.ts` and drag scenario, then `npm run test:e2e:ci`, `npm run test:contract`, and `npm run openspec:validate:ci`.
- [ ] 7.3 Inspect the final diff for accidental engine, dependency, `Cargo.lock`, generated artifact, or unrelated design changes and remove any such drift.
- [ ] 7.4 Obtain an independent code review against this proposal, design, and every scenario; address findings and rerun affected verification.
- [ ] 7.5 Push the GUI branch, confirm required pull-request checks including the Windows bundle gate, merge through the normal review path, and verify the resulting patch release publishes working MSI and NSIS installers before declaring the fix shipped.
