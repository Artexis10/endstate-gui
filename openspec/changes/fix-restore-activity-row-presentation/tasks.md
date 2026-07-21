## 1. Lock the contracts with failing tests

- [x] 1.1 Add row-mapping tests: a legacy `restore-item` renders `Notepad++ · contextMenu.xml` (never `/copy:` or `->`), falls back to `<module-id> · <basename>`, derives the module id from the source path, and keeps a stable identity across the lifecycle.
- [x] 1.2 Add reconciliation tests reproducing the screenshot: a ref-keyed live row + its id-keyed envelope action collapse to one row; apply+verify rows for one app yield one row; final app rows equal the envelope actions; restore rows survive reconciliation.
- [x] 1.3 Add `LiveActivityPanel` render tests: RESTORING/RESTORED labels (never INSTALLING), friendly name with no `/copy:`, raw detail only in the hover title, muted secondary skip reason, and a distinct SAVED artifact line (not DETECTED).
- [x] 1.4 Extend the mocked e2e lifecycle to stream a restore item (restoring→terminal) and one app across apply+verify, asserting no `/copy:` text and single-row-per-item.

## 2. Map restore & artifact events

- [x] 2.1 Add `src/lib/restore-activity.ts` with module-id derivation, display-name resolution, basename extraction, stable keys, secondary copy, and `restoreEventToAppEvent` / `artifactEventToAppEvent`.
- [x] 2.2 Add the additive `captureId`/`configSetId`/`targetInstanceId`/`sourceGeneration`/`targetGeneration` fields to `RestoreItemEvent` in `src/lib/streaming-events.ts`.

## 3. Reconcile rows

- [x] 3.1 Extend `AppEvent` with `kind`/`restoreStatus`/`secondary`/`title` and add `getActivityRowLabel` in `src/lib/apply-utils.ts`.
- [x] 3.2 Rewrite `reconcileLiveActivity` to match live rows to envelope actions by `id` or `ref`, collapsing duplicates while preserving restore/artifact/header rows.
- [x] 3.3 Update `deriveCountersFromEvents` to detect restore/artifact rows by `kind`.
- [x] 3.4 Replace the always-append restore handler in `src/App.tsx` with in-place reconciliation via `appEventIndex`, threading display-name context; render the artifact completion line.
- [x] 3.5 Thread `restoreModulesAvailable`/`configModuleMap` through `ApplyRestoreOptions` and the Setup flow apply call.

## 4. Render friendly rows

- [x] 4.1 Consume `getActivityRowLabel` and render name / muted secondary / hover title in `live-activity-panel.tsx` and the Setup flow apply + results lists.

## 5. Document and verify

- [x] 5.1 Add the restore-row and produced-artifact presentation rules to `docs/ux-language.md`.
- [ ] 5.2 Run unit + e2e suites, `tsc --noEmit`, and lint; confirm no `/copy:` text and single-row transitions.
