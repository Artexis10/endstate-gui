## Why

Engine 2.32.0 adds a second kind of settings to a saved setup: Windows settings that belong to no app (module tier `windows-settings`). The GUI assumed that every settings module belonged to an app. With a real capture of seven Windows settings modules, the GUI did the following:

- "What's inside" listed the Windows settings as app settings with the line "Association could not be identified", and counted them as unidentified app settings rows.
- The restore choice said "This profile includes settings for 47 apps" when 7 of the 47 were Windows settings.
- The settings selector mixed the Windows settings into the app list and counted their registry values as "files".
- Setup results mixed the Windows settings rows into the app rows, and a failed row read "Couldn't restore this file".
- Capture results listed the Windows settings under "Settings only — app installation not included", as if an app installer were missing.
- With engine 2.32.0 on a real bundle, the "Settings compatibility" section drew three blocks under one heading, "Compatibility unknown": 24 settings saved before compatibility checks, 23 already up to date, and 1 with no detected target. None needed a decision, and one block read as both "unknown" and "already has the desired settings". In a long list this read as duplicated noise.

## What Changes

- Read the module tier from the module ID (`<tier>.<name>`) in one place, `src/lib/settings-kind.ts`. The `apps` tier, and an ID without a tier, is an app's settings. Every other tier is settings that belong to no app.
- Show the Windows settings as their own group, named "Windows settings", in profile contents, in the restore choice, in the settings selector, in the setup results and in the capture results. A tier that the GUI does not know shows as "Other settings".
- Keep the restore opt-in: nothing in the Windows settings group is selected by default, it has its own Select all, and the restore filter receives the full module ID.
- Word `registry-set` rows as settings, not files, and show only the target in their hover title.
- Keep per-module capture notes behind the Details disclosure, because they name registry values.
- Make the setup preview and results lists calm for a long run: the chips are the one place for counts, failed rows lead under "Needs attention" outside the scrolling list, a row shows secondary text only for a failure, a Windows setting shows its label alone under its heading, and an outcome that changed nothing is muted.
- Fold the settings compatibility rows that need nothing from the person into one quiet line, "Compatibility not checked for 41 app settings and 7 Windows settings. 47 of them were saved before Endstate checked versions." A card stays only for a row that needs the person: a target to choose, `migrate`, `incompatible`, a failed status, or an `unknown` with a reason that is not on the engine's short list of harmless ones. The engine's message for each setting moves into the details, once per message. The quiet line is the compatibility notice that the restore choice requires before execution.

## Capabilities

### New Capabilities

- `windows-settings-presentation`: how the GUI shows settings that belong to no app, from profile contents through capture and setup results.
- `setup-list-presentation`: the setup preview and results lists show failures first, keep one place for counts and say only what adds information.

### Modified Capabilities

- `command-warning-presentation`: warning details show every technical field, and the capture warning `config_secret_scope_conflict` names its module in plain words.
- `config-generation-presentation`: configuration resolutions that need nothing from the person fold into one quiet line, and a card shows only for a row that needs the person. The live list while Apply runs uses the same rule.
- `restore-module-approval`: the compatibility notice before execution is that quiet line, with the engine message for each module in its details.

## Impact

- GUI only: `src/lib/settings-kind.ts`, `src/components/app/intent/profile-contents-modal.tsx`, `src/components/app/intent/setup-flow.tsx`, `src/components/app/intent/save-flow.tsx`, `src/components/app/overview/components/config-module-selector.tsx`, `src/components/app/overview/components/restore-intent-toggle.tsx`, `src/lib/restore-activity.ts`, `src/lib/apply-utils.ts`, `src/components/app/intent/config-resolution-list.tsx`, `src/components/app/intent/config-migration-progress.tsx`, `src/lib/config-resolution-fold.ts`, `docs/ux-language.md`.
- No engine change, and no change to the status labels or the settings counts that `restore-results-honest-omissions` defines. The colour of PRESENT changes from green to muted, to match UP TO DATE.
- A setup run carries no verify result for Windows settings. The engine checks them only in `verify` and `rebuild`, so the setup results show restore outcomes only.
