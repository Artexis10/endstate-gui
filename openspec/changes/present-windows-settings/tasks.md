## 1. Read the tier once

- [x] 1.1 Add `src/lib/settings-kind.ts`: tier from the module ID, the app-module key, and the group copy.
- [x] 1.2 Use it for every `apps.` qualifier match in `setup-flow.tsx` and `restore-activity.ts`.

## 2. Show the group at each step

- [x] 2.1 Profile contents: own tab and badge; no association line; not counted as unidentified.
- [x] 2.2 Restore choice: count app settings and Windows settings separately.
- [x] 2.3 Settings selector: own group, own Select all, entry noun "value", full module ID to the restore filter.
- [x] 2.4 Setup results: own heading after the app rows; "setting" wording and target-only hover title for `registry-set` rows.
- [x] 2.5 Capture results: own heading; per-module notes behind Details.
- [x] 2.6 Document the group in `docs/ux-language.md`.
- [x] 2.7 Setup preview: count each group apart in module counts; the settings chip counts the rows its filter shows.
- [x] 2.8 Restore rows: use the engine `label` (engine 2.32.0+) after the module name; a `registry-set` row shows no value name and no engine message inline.
- [x] 2.9 Capture results and setup results fallbacks: count each group apart; list three groups as "a, b and c"; the capture settings chip counts its rows.
- [x] 2.10 Results rows: find an app row's settings through its package ref, as in the preview; treat `registry-import` rows like `registry-set` rows; start the hover title with the full row text.

## 4. Mirror the engine contract (engine 2.32.0)

- [x] 4.1 `docs/ux-language.md`: restore statuses and engine messages as in the event contract; record that no GUI screen renders verify items, so `not_restored` needs no mapping yet.
- [x] 4.2 `docs/config-integration-design.md`: restore-item example message, full restorer list, optional `label`.
- [x] 4.3 `src/types.ts`: one warning shape with `source` and `moduleId`; `CaptureWarning` is the same type.
- [x] 4.4 `openspec/specs/engine-capture-contract.md` (a GUI-side contract document, edited directly as before): `sensitiveExcludedCount`, `configModules[].warnings`, `config_secret_scope_conflict`.
- [x] 4.5 Warning details show every technical field; the secret-scope capture warning names its module in plain words.

## 5. Calm setup lists

- [x] 5.1 Results header shows the verdict only; the preview header keeps only its settings line; chip rows wrap.
- [x] 5.2 Failed rows lead under "Needs attention", outside the scrolling list, in the preview and results lists.
- [x] 5.3 Restore rows show secondary text only on failure; a labelled row shows its label alone under its group heading.
- [x] 5.4 Results rows drop the settings icon; PRESENT and its chip are muted, from the one status map.
- [x] 5.5 Update `docs/ux-language.md`, "Setup preview and results lists".
- [x] 5.6 A failed app row reads "Couldn't install this app" with the engine message in its hover title; MANUAL rows lead under "Needs attention" from a status-map flag.

## 3. Proof

- [x] 3.1 Unit: Windows rows are not unidentified app settings; a selected Windows module reaches apply by full ID in its own group; captured Windows settings are not "Settings only"; the preview chip and module counts keep Windows settings apart.
- [x] 3.2 E2E (`e2e/windows-settings-restore.spec.ts`): the restore filter carries full IDs; results group the rows and the header counts equal them; no registry value name, path or registry error is row text.
- [x] 3.3 Chrome DevTools: real engine import, contents, consent and dry-run results; mock engine apply results and capture results; light and dark.
- [x] 3.4 Unit: failed rows lead and count once per chip; an up-to-date row carries no secondary text.
- [x] 3.5 Chrome DevTools at 800x600 and 500 px, dark and light: a worst-case and a 100-app mock run, results and dry-run results, and the preview list.

## 6. Quiet settings compatibility

- [x] 6.1 `src/lib/config-resolution-fold.ts`, used by `config-resolution-list.tsx`: decide each row from `resolution`, `reason` and `status`; fold the rows that need nothing from the person into one quiet line, with the counts computed from the distinct modules; keep the cards and the target picker for the rest.
- [x] 6.2 Details: each engine label and message once, the settings under each message, each with status and provenance.
- [x] 6.3 `docs/ux-language.md`, "Settings compatibility (setup preview and results)".
- [x] 6.4 Unit: the fold rule per branch, the counts from the data, the copy; mutation-check the rule.
- [x] 6.5 Chrome DevTools at 800x600, dark and light: preview and results of a mock run with the real distribution (24 / 23 / 1), and one run that keeps an `incompatible` and an `ambiguous_target_instance` card.
- [x] 6.6 Live Apply list: `config-migration-progress.tsx` folds `config-resolution` events by the same rule, from the shared `src/lib/config-resolution-fold.ts`; the quiet line sits outside the live region; migration events stay rows.
- [ ] 6.7 Archive order: `clarify-setup-import-and-settings` MODIFIES "GUI Renders Engine-Owned Config Resolution Results" and replaces "Per-module restore selection during Apply" (REMOVED, then ADDED under a new name). This change MODIFIES both too. Whichever change archives second MUST carry the changes of both: the quiet-line wording in the first, and in the second the quiet-line notice in place of the engine warning.
