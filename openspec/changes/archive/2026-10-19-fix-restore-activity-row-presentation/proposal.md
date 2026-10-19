## Why

The Setup flow's live activity feed mispresents config-restore progress and duplicates rows, which is user-visible on a real run just before public launch:

- Legacy config-restore items render as the **raw engine copy-spec** — e.g. `⚙ /copy:./configs/notepad-plus-plus/contextMenu.xml->%APPDATA%/Notepad++/contextMenu.xml` — violating the hard rule that raw engine strings / CLI jargon are never surfaced.
- The transitional (`restoring`) and terminal (`restored`/`skipped`/`failed`) restore events append as **two separate rows** instead of updating one row in place.
- Restore items are labelled **INSTALLING**, the wrong verb for a settings restore.
- The final results list **duplicates app rows across phases**: an app streams once per phase (apply then verify) keyed by the winget `ref`, while the envelope action is keyed by the manifest `id`; when `ref != id` both survive (e.g. `PRESENT WinDirStat` beside `INSTALLED WinDirStat`, or `FAILED voidtools.Everything` twice). The header summary is envelope-derived and correct — only the row list duplicates.
- The produced-artifact event renders like an app row (`DETECTED Manifest`) instead of a distinct completion line.

## What Changes

- Map `restore-item` events to a friendly row: primary = engine module display name + target file basename (e.g. `Notepad++ · contextMenu.xml`), falling back to `<module-id> · <basename>` derived from the source path — never the raw copy-spec.
- Use restore verbs (RESTORING / RESTORED / UP TO DATE / MISSING / FAILED), not the app INSTALLING verb, and surface a friendly, jargon-free skip/failure reason as muted secondary text.
- Key every restore item by a stable identity (target path) so its transitional and terminal events update **one row in place**.
- Reconcile app rows into the envelope-authoritative action list by stable identity (`id` **or** `ref`), collapsing the ref-keyed live row into its id-keyed envelope action so each app renders exactly once across plan → apply → verify.
- Keep raw `source→target` detail available only behind a hover title / disclosure.
- Render the produced-artifact event as a distinct muted "Saved profile bundle" completion line, keeping artifact visibility.

## Capabilities

### New Capabilities

- `restore-activity-presentation`: Defines how config-restore rows and produced-artifact lines appear in the activity feed — engine-named, restore-verbed, single-row-per-item, jargon-free.

### Modified Capabilities

- `final-state-from-envelope`: The reconciled activity list is envelope-authoritative and shows exactly one row per app across all phases, keyed by stable identity, with no residual live duplicates.

## Impact

- `src/lib/restore-activity.ts` (new): pure `restore-item` / `artifact` → `AppEvent` row mapping with stable keys and display-name resolution.
- `src/lib/apply-utils.ts`: `AppEvent` gains `kind`/`restoreStatus`/`secondary`/`title`; `reconcileLiveActivity` matches by `id`/`ref`; a shared `getActivityRowLabel` centralises restore/artifact/app labels; counter derivation keys off `kind`.
- `src/lib/streaming-events.ts`: `RestoreItemEvent` gains the contract's additive `captureId`/`configSetId`/`targetInstanceId`/`sourceGeneration`/`targetGeneration` fields.
- `src/App.tsx`: restore-item handler reconciles in place with display-name context; artifact handler renders the distinct completion line.
- `src/components/app/intent/setup-flow.tsx` and `src/components/app/overview/components/live-activity-panel.tsx`: consume the shared label helper and render friendly name / secondary / hover title.
- `src/types.ts`: `ApplyRestoreOptions` threads the preview envelope's display-name context.
- `docs/ux-language.md`: adds the restore-row and produced-artifact presentation rules (cross-repo coupling with `../endstate/docs/event-contract.md`).
