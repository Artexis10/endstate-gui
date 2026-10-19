## 1. Restore status presentation

- [x] 1.1 Map `skipped_missing_source` to NOT IN SETUP / "Not included in the saved setup" (muted) in `RESTORE_STATUS_MAP`, with a count phrase per status.
- [x] 1.2 Add preview labels (TO RESTORE, CHECKING) and resolve them from the run's dry-run flag on each restore row.
- [x] 1.3 Count settings outcomes from the reconciled restore rows (`countRestoreOutcomes`) and use that one source in the results header, settings chip, progress line and result modal.
- [x] 1.4 Treat a failed restore as an error in the results header.
- [x] 1.5 Update `docs/ux-language.md` "RESTORE rows" as the single mapping source.

## 2. Command warnings

- [x] 2.1 Show the engine message as the visible line; move driver and ref behind the Details disclosure.

## 3. Proof

- [x] 3.1 Unit: missing-source rows are neutral; a dry-run row never reads RESTORED; a failed row stays an error; the modal lists each outcome under its own label.
- [x] 3.2 E2E (`e2e/restore-activity-rows.spec.ts`): a mixed run shows each outcome and the header counts equal the rows; a dry run shows no RESTORED row.
- [x] 3.3 Render the results screen in Chrome DevTools for a real run and a dry run, light and dark, at the 800×600 window size.
