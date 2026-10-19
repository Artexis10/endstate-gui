## Why

After Apply, the results screen told a first-time user things that were not true:

- An optional settings file that the old PC never had (engine status `skipped_missing_source`) rendered as a yellow **MISSING** warning, although absence of configuration is not a failure.
- A dry run labelled the settings it would restore **RESTORED**, and its header said "1 setting restored". The engine keeps the per-item status `restored` in a preview; the dry-run flag is run-level.
- The header counted only restored and failed settings, folded up-to-date and missing-source rows into a hidden "skipped" number, and the "without settings" chip counted restore rows as apps. The header, chips and rows did not agree.
- A failed settings restore left the header reading "Setup complete".
- Command warnings showed `Driver: … · Ref: …` jargon in the default view.

The restore status mapping is a contract between the engine (`event-contract.md`) and the GUI (`docs/ux-language.md`), so the presentation change belongs in the specification.

## What Changes

- Map `skipped_missing_source` to a neutral (muted) **NOT IN SETUP** / "Not included in the saved setup" row. Use the engine message as the secondary line when it is clean. Verify **MISSING** for an app that is not installed keeps its warn mapping.
- Show preview restore rows in preview language (**TO RESTORE** / "Would restore", **CHECKING** while in progress), from the run's dry-run flag. A preview never shows RESTORED.
- Derive every settings count (header, settings chip, progress line, result modal) from the reconciled restore rows, one per target, and list restored, already up to date, not in saved setup and failed. The apply envelope has no restore summary; the GUI stops reading one.
- Make a failed restore read "Setup completed with errors", or "Preview completed with errors — nothing was installed" in a dry run. Keep FAILED red.
- Keep the engine's warning message as the visible line and move driver and ref behind the existing Details disclosure.

## Capabilities

### Modified Capabilities

- `restore-activity-presentation`: restore row labels, preview language, neutral missing-source rows and one counting source.
- `command-warning-presentation`: driver and ref move behind the Details disclosure.

## Impact

- GUI only: `src/lib/apply-utils.ts`, `src/lib/restore-activity.ts`, `src/App.tsx`, `src/components/app/intent/setup-flow.tsx`, `src/components/app/apply-result-modal.tsx`, `src/components/app/command-warning-list.tsx`, `docs/ux-language.md`.
- No engine change. Engine 2.32.0 keeps the same restore status set and rewrites engine messages; the GUI renders those messages verbatim.
- Archive order: the `restore-activity-presentation` capability exists only in the unarchived change `fix-restore-activity-row-presentation`. Archive that change first, so this change's MODIFIED delta has a target spec.
