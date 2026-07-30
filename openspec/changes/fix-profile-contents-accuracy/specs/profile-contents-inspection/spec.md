## ADDED Requirements

### Requirement: App and app-settings inventories are independently navigable

The contents summary SHALL present **Apps** and **App settings** as separate tabs with totals derived from the rows in each inventory. The dialog SHALL provide search scoped to the active tab so a user can find an entry without scrolling through the other inventory.

#### Scenario: User switches directly to app settings
- **WHEN** a profile contains apps and captured app settings
- **THEN** the dialog opens on the **Apps** tab
- **AND** the user can activate **App settings** without scrolling past the apps list

#### Scenario: Settings-only profile opens its populated tab
- **WHEN** a profile contains captured app settings but no apps in its Apps inventory
- **THEN** the dialog opens on the **App settings** tab
- **AND** the empty apps inventory remains available as a separate tab

#### Scenario: Search filters only the active inventory
- **WHEN** the user searches in either tab by friendly name or package identifier
- **THEN** matching rows in the active inventory remain visible
- **AND** the tab totals continue to describe the complete profile rather than the filtered result
- **AND** the inactive inventory is unchanged

#### Scenario: Search has no matches
- **WHEN** the active inventory contains no row matching the search query
- **THEN** the dialog shows a calm no-results message
- **AND** it does not present the profile as empty or invalid

#### Scenario: Tab controls are keyboard operable
- **WHEN** keyboard focus is within the tab control
- **THEN** the user can move between **Apps** and **App settings** using standard tab keyboard behavior
- **AND** focus and selected-state semantics are exposed to assistive technology

## MODIFIED Requirements

### Requirement: Inspecting a profile changes nothing

Opening the contents summary SHALL be read-only. The GUI MAY invoke the engine's dedicated profile-inspection command, but SHALL NOT select the profile, request a machine preview, run app or settings detection, or modify the machine as a result of inspection.

#### Scenario: Inspection does not start a setup run
- **WHEN** the user activates **What's inside** on a profile card
- **THEN** the profile is not selected
- **AND** no apply preview is requested
- **AND** no app or settings detection is run
- **AND** no apply command is invoked

#### Scenario: Inspection uses its own read-only command boundary
- **WHEN** the GUI needs structured profile contents from the engine
- **THEN** it invokes only the dedicated profile-inspection command
- **AND** the command reads the saved profile without evaluating the current machine

### Requirement: Summary reports what the profile will apply

The summary SHALL report the capture timestamp when the profile records one, the number of applications in its Apps inventory, and the distinct verified applications for which the profile carries settings. The default UI SHALL describe the latter as **Settings for N apps**, SHALL ensure every profile-owned settings module contributes to an app-settings row, and SHALL NOT describe captured files or restore entries as individual settings. Multiple owned modules SHALL be grouped only when they share the same verified application owner. Ambiguous or unresolved rows SHALL remain visible but SHALL be reported separately as unidentified instead of inflating the application count.

#### Scenario: Apps and app settings are counted semantically
- **WHEN** a profile contains 72 app entries and settings modules associated with 8 distinct apps
- **THEN** the summary reports **72 apps**
- **AND** it reports **Settings for 8 apps**
- **AND** the **App settings** inventory contains 8 rows

#### Scenario: Application is named
- **WHEN** the inspection result carries an application display name
- **THEN** the **Apps** inventory lists the application by that display name
- **AND** its package identifier remains searchable

#### Scenario: Application carries settings
- **WHEN** an application in the Apps inventory is associated with a profile-owned settings module
- **THEN** its row in the **Apps** inventory shows a subtle settings-included indicator
- **AND** the same application appears once in the **App settings** inventory

#### Scenario: Settings-only application remains visible
- **WHEN** a profile owns settings for an application that is absent from its Apps inventory
- **THEN** the **App settings** inventory contains that application
- **AND** the row calmly states that the app is not included
- **AND** the application is not added to the Apps total

#### Scenario: Unidentified settings ownership does not inflate the app count
- **WHEN** one or more owned settings modules cannot be uniquely associated with an application
- **THEN** each module remains represented in the **App settings** inventory
- **AND** those rows do not increase the **Settings for N apps** count
- **AND** the normal summary reports the number of unidentified rows separately

#### Scenario: Capture file counts stay technical
- **WHEN** an app-settings module contains one or more captured files or restore entries
- **THEN** those entry counts do not appear in the default inventory row
- **AND** they MAY appear under **Configuration details**

#### Scenario: Capture timestamp is shown when recorded
- **WHEN** the profile records a capture timestamp
- **THEN** the summary shows when the profile was captured

#### Scenario: Capture timestamp is absent
- **WHEN** the profile records no capture timestamp
- **THEN** the summary states that no capture date is recorded
- **AND** no date is invented

### Requirement: Settings-free and app-free profiles read as normal outcomes

A profile carrying no settings, or no applications, SHALL be described in calm, explanatory language. The GUI SHALL NOT present either case as a warning or an error, and SHALL select the populated tab when only one inventory contains rows.

#### Scenario: Install-only profile
- **WHEN** a profile declares applications but no captured settings
- **THEN** the summary states that the profile includes apps but no app settings
- **AND** no warning or error treatment is applied

#### Scenario: Settings-only profile
- **WHEN** a profile declares captured settings but no applications
- **THEN** the summary states that the profile carries app settings but includes no apps
- **AND** the **App settings** tab is initially active

### Requirement: The summary never exposes raw provenance ids

The default summary SHALL NOT use a module id, capture id, config-set id, or file path as user-facing label text. Every profile-owned settings module SHALL remain represented even when no friendly name or unique application association resolves; such a module SHALL use neutral unidentified-app copy rather than disappearing from the list. Exact identifiers, ambiguous candidates, and the manifest path SHALL be exposed only through **Configuration details**, consistent with `config-generation-presentation`.

#### Scenario: Unresolvable module remains a visible row
- **WHEN** a profile-owned settings module has no friendly label resolvable from profile evidence or the module catalog
- **THEN** the module still contributes one row to the **App settings** tab total
- **AND** the row uses neutral unidentified-app copy
- **AND** its raw module id does not appear as the default label
- **AND** it does not increase the verified **Settings for N apps** count

#### Scenario: Identifiers live behind the disclosure
- **WHEN** the show-details setting is on and the user opens **Configuration details**
- **THEN** package refs, module ids, ambiguous association candidates, captured-entry counts, manifest version, and manifest path are shown

#### Scenario: Disclosure is absent by default
- **WHEN** the show-details setting is off
- **THEN** no **Configuration details** disclosure is offered
- **AND** no module id or file path appears anywhere in the summary

### Requirement: The summary uses read-only engine profile inspection

The GUI SHALL consume a structured result from the engine's dedicated profile-inspection command. The saved profile SHALL remain authoritative for application membership, settings ownership, and entry counts; bundle snapshots, captured metadata, and the engine module catalog MAY enrich labels and associations but MUST NOT add settings that the profile does not own. Every association SHALL be classified as uniquely included, known but absent from the Apps inventory, ambiguous, or unresolved. The command SHALL NOT inspect current-machine installation or settings state.

#### Scenario: Profile evidence determines ownership
- **WHEN** the current engine catalog contains a settings module that the profile did not capture
- **THEN** that module does not appear in the app-settings inventory

#### Scenario: Bundled module display name is used
- **WHEN** a manifest-v2 config capture references a readable module snapshot inside the bundle
- **THEN** the settings row uses the display name recorded in that snapshot

#### Scenario: Legacy profile label is enriched from the catalog
- **WHEN** a legacy profile owns a known settings module but lacks a bundled display name
- **THEN** the engine resolves its friendly label from captured metadata or the matching module catalog entry
- **AND** catalog membership does not change the settings total

#### Scenario: Unique association marks both inventories consistently
- **WHEN** one owned settings row is uniquely associated with an application in the Apps inventory
- **THEN** the row identifies that application with association state `included`
- **AND** that application's Apps row reports that settings are included

#### Scenario: Ambiguous association marks no application
- **WHEN** an owned settings module plausibly matches more than one application in the Apps inventory
- **THEN** the settings row remains visible with association state `ambiguous`
- **AND** none of the candidate Apps rows is marked as carrying those settings
- **AND** the row is excluded from the verified app-settings count

#### Scenario: Presentation-affecting warning remains visible
- **WHEN** the inspection result carries an engine-authored warning that says inventory completeness is degraded
- **THEN** the normal dialog shows that engine-authored warning
- **AND** the GUI does not present the inventory as unconditionally complete
- **AND** it does not derive warning impact by parsing warning text

#### Scenario: Older engine lacks inspection capability
- **WHEN** the active engine does not advertise dedicated profile inspection
- **THEN** the GUI does not fabricate app-settings names or associations
- **AND** it explains that Endstate must be updated to inspect app settings accurately

#### Scenario: Unreadable profile is surfaced
- **WHEN** the profile manifest cannot be read or parsed
- **THEN** the summary reports that the profile could not be read
- **AND** does not present an empty profile as a valid summary

## RENAMED Requirements

- FROM: `### Requirement: The summary reads only extracted profile files`
- TO: `### Requirement: The summary uses read-only engine profile inspection`
