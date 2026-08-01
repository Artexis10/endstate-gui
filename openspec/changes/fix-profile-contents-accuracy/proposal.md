## Why

The released **What's inside** dialog describes distinct app-settings modules as individual "settings" and can omit every settings row from older profiles when module ids do not exactly match captured app ids. That makes a read-only trust surface misleading precisely when users are deciding whether a profile is safe and useful to apply.

## What Changes

- Present profile contents as two searchable tabs: **Apps** and **App settings**.
- Replace ambiguous counts such as **8 settings** with explicit ownership language such as **Settings for 8 apps**.
- Keep every profile-owned settings module represented in an app-settings row, grouping modules only when they have the same verified app owner, retaining settings-only apps, and reporting unidentified ownership separately instead of inflating the app count.
- Resolve app-settings labels through a narrow read-only engine inspection contract while keeping the profile manifest authoritative for ownership and counts.
- Show captured-file counts, package refs, module ids, and profile paths only under **Configuration details**; they are not setting counts and do not belong in the default summary.
- Keep inspection independent of profile selection, machine preview, and apply. Opening the dialog may inspect the saved profile but MUST NOT evaluate or change the current machine.

## Capabilities

### New Capabilities

<!-- None. -->

### Modified Capabilities

- `profile-contents-inspection`: Correct settings ownership semantics, require complete app-settings representation, add tabbed/searchable navigation, and replace the local-only inspection restriction with a read-only engine inspection contract.

## Impact

- GUI profile-content modeling and presentation in `src/lib/profile-contents.ts` and `src/components/app/intent/profile-contents-modal.tsx`.
- Set up flow wiring, engine capability detection/invocation, TypeScript contract types, and targeted unit/E2E coverage.
- Coordinated Endstate engine work for a structured read-only profile inspection envelope and capability advertisement.
- Bundled engine revision and GUI/engine contract documentation; no new runtime dependency and no profile-format migration.
