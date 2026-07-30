## Context

The 3.9.0 **What's inside** dialog reads an extracted manifest directly in the GUI and builds two sequential lists. Its `settingsModuleCount` counts distinct settings modules, while its rendered `settings` array contains only modules whose ids happen to resolve to friendly labels. A real legacy profile therefore reports **8 settings** but renders no settings rows: ids such as `obsidian` do not exactly match captured app ids such as `obsidian-obsidian` or package refs such as `Obsidian.Obsidian`.

There are three separate problems:

1. **Semantic:** a settings-module count is the number of apps with captured settings, not a number of individual settings.
2. **Contract:** the GUI is independently interpreting profile semantics even though the engine and its module catalog own those semantics.
3. **Navigation:** a single scrolling document makes the user pass a long app list before reaching app settings.

The profile itself must remain authoritative for what it owns. Current catalog data can improve a label or association, but cannot make an uncaptured settings module appear. Inspection must also remain distinct from `apply --dry-run`: it describes the saved artifact and never evaluates the current machine.

## Goals / Non-Goals

**Goals:**

- Describe settings as belonging to apps and keep every owned settings module represented.
- Provide polished, searchable **Apps** and **App settings** tabs.
- Move profile interpretation and legacy label resolution into a narrow read-only engine contract.
- Keep counts and rendered inventories structurally consistent.
- Preserve progressive disclosure for package refs, module ids, captured-file counts, and paths.
- Ship the engine contract before the GUI depends on it and capability-gate the integration.

**Non-Goals:**

- Detect whether apps or settings are present on the current computer.
- Reuse apply preview, synthesize setup rows, or change setup/apply behavior.
- Select which settings will be restored from this dialog.
- Display individual setting values or treat captured files as settings.
- Change the profile or capture-bundle format.
- Add fuzzy ownership inference in the GUI.

## Decisions

### 1. Add a dedicated `profile inspect` engine operation

The engine will expose `endstate profile inspect <manifest-path> --json`. The first version intentionally accepts the extracted manifest path already held by `DiscoveredProfile`; it may read the manifest's existing sibling metadata and verified `provenance/modules/` snapshots. It returns a normal schema-1.x envelope whose data includes:

- profile metadata (`name`, capture time, and manifest version);
- `apps[]` with stable identity, friendly display name, package refs, and `hasSettings`;
- `settingsApps[]` with stable app-settings identity, friendly display name, an explicit `associationStatus`, associated app/owner identity when verified, `appIncluded`, contributing module ids for diagnostics, and captured-entry count;
- engine-authored warnings carrying diagnostic or presentation-affecting impact.

The command will not invoke drivers, path-exists matchers, package detection, planning, preview, restore resolution, or mutation. Arrays will always be non-null and returned in deterministic display order.

The engine may also return summary counts for CLI consumers, but it must construct them from the finalized arrays. The GUI will render tab totals from `apps.length` and `settingsApps.length`. It will describe only uniquely owned/grouped rows as **Settings for N apps** and will report ambiguous or unresolved rows separately as unidentified, so neither omission nor uncertain ownership can inflate an app count.

**Alternatives considered:**

- `profile validate` is too shallow and does not resolve settings ownership or labels.
- `apply --dry-run` already carries some names, but it plans against the current machine and would collapse inspection into preview.
- Keeping a GUI-only parser is smaller locally, but it duplicates engine semantics and cannot reliably label legacy profiles.
- Accepting zip bundles and profile directories would make the new CLI command more general, but the GUI has no such caller and the extra extraction/cleanup behavior is unnecessary for this patch.

### 2. Advertise inspection as an additive capability

The capabilities envelope will add `features.profileInspection: true`. This is an additive schema-1.x field and avoids pretending that a subcommand is a flag in `commands.profile.flags`.

The GUI will call `profile inspect` only when advertised. A non-advertising engine will show an honest unsupported-state message asking the user to update Endstate; it will not fall back to guessing settings names or associations. The released GUI will bundle the matching engine, so this state primarily protects custom or stale engine installations.

**Alternative considered:** adding a generic `subcommands` array to every command capability is cleaner long term but broadens an urgent fix beyond what this feature needs.

### 3. Separate ownership evidence from label enrichment

The engine will first determine settings ownership from the saved profile, then enrich each owned row:

- Manifest v2: distinct module ids from `configCaptures` and any declared legacy config lanes, deduplicated before presentation.
- Manifest v1: explicit `restore[].fromModule`, declared config-module metadata, and legacy bundle metadata in authority order; old `configs/<module-id>/...` restore sources remain last-resort profile evidence.

Friendly-name resolution will use:

1. a verified embedded module-snapshot display name for v2;
2. captured module metadata when present;
3. the current catalog display name for the already-owned module;
4. an associated manifest app display name or package ref;
5. a deterministic human-readable rendering of the short module id.

Association uses captured evidence and catalog package refs. It determines `appIncluded` and `hasSettings`, never whether the settings module belongs to the profile. Each `settingsApps[]` row carries one of four association states:

- `included`: exactly one Apps-inventory entry owns the settings;
- `not_in_profile`: a stable app owner is known, but that app is absent from the Apps inventory;
- `ambiguous`: more than one Apps-inventory entry is a plausible owner;
- `unresolved`: no stable app owner can be established.

Every owned module contributes to exactly one row. Modules are grouped only when they share the same verified owner identity; ambiguous and unresolved modules remain separate so evidence is never discarded. Multiple config sets or instances for one module are likewise deduplicated. `apps[].hasSettings` is true if and only if at least one `included` settings row uniquely references that app. Ambiguous rows mark no app.

An ambiguous, unresolved, or removed module remains present with neutral unidentified-app copy. It contributes to the **App settings** tab total but not to **Settings for N apps**; the normal summary reports the unidentified row count separately. Its raw id and any ambiguous candidates are available only in technical details.

**Alternative considered:** exact id matching against manifest apps is what failed for the real legacy profile and is not sufficient.

### 4. Use two compact, searchable inventories

The dialog will use an accessible tab control:

- **Apps (N)** is initially active when the profile contains at least one app entry.
- **App settings (N)** is initially active for a settings-only profile.

Each tab owns one scrollable list and one search field. Search is case-insensitive and matches the engine-provided friendly label plus package/module identifiers, while technical identifiers remain visually hidden unless details are enabled. Changing profile or reopening the dialog clears search; switching tabs does not mutate either inventory.

App rows use the same compact icon/label/status rhythm as Setup preview. An app with uniquely associated captured settings receives a quiet settings indicator. App-settings rows use the friendly app name; `not_in_profile` rows carry the muted secondary copy **App not included**, while ambiguous/unresolved rows use engine-authored unidentified copy. Search with no matches produces a local no-results state without changing the tab total.

The dialog grows to a medium width, while header, tab/search controls, and footer remain fixed and only the active list scrolls.

**Alternatives considered:**

- A unified app list makes settings-only apps and the meaning of the app count harder to explain.
- Two sequential sections preserve the current long-scroll problem.

### 5. Keep implementation details behind disclosure

Default rows will not show captured-file counts. **Configuration details**, when globally enabled and explicitly opened, may show package refs, module ids, captured-entry counts, manifest version, diagnostic-only warnings, and path. This retains diagnostic value without presenting files as user settings.

An engine warning whose impact means the inventory may be incomplete is different: its engine-authored message remains visible in the normal dialog and the UI does not claim an unconditional complete inventory. The GUI does not infer warning impact from text.

Read/parse failures remain explicit errors rather than valid empty profiles. A genuinely empty inventory is calm and descriptive, not a warning.

## Risks / Trade-offs

- **Cross-repository release ordering** → Merge and release the additive engine contract first, then update the GUI's bundled-engine revision and capability-gated consumer.
- **Legacy artifacts contain incomplete metadata** → Resolve labels through the catalog only after ownership is established; always keep one row per owned module and use a neutral fallback.
- **Duplicate summary and array counts drift** → Build engine summary counts from finalized arrays and derive GUI totals from those same arrays.
- **Ambiguous associations mark the wrong app** → Model association state explicitly; only a unique `included` reference can set `hasSettings`, and unidentified rows are counted separately.
- **Inspection could accidentally become machine evaluation** → Contract and test that no drivers, matchers, planner, or apply path are invoked.
- **New tabs regress accessibility** → Use a proper tab primitive or implement the complete tablist keyboard/ARIA contract, and cover it with component tests.
- **Opening inspection against a stale external engine fails** → Capability-gate and provide a specific update message instead of silently degrading into inaccurate data.

## Migration Plan

1. Add and validate the engine OpenSpec/contract delta for `profile inspect` and `features.profileInspection`.
2. Implement and release the engine command with hermetic v1/v2 fixtures, including the real legacy id-mismatch shape and ambiguous/unresolved associations.
3. Update the GUI's bundled-engine revision and structured TypeScript contract.
4. Replace the local profile-content summarizer with the capability-gated inspection call and implement the two-tab modal.
5. Verify unit/contract tests and drive the real modal against a large legacy profile before the GUI patch release.

Rollback is straightforward: revert the GUI consumer while leaving the additive engine command in place. The engine addition has no profile migration and remains backward compatible.

## Open Questions

None. The user-approved product shape is two tabs with scoped search, app-owned settings language, complete rows, and technical counts hidden by default.
