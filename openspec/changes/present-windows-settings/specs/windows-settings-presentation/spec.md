## ADDED Requirements

### Requirement: Settings that belong to no app are their own group

The GUI SHALL read a settings module's tier from its module ID, which has the form `<tier>.<name>`. A module of the `apps` tier, or a module ID without a tier, SHALL be treated as an app's settings. A module of any other tier SHALL be treated as settings that belong to no app and SHALL NOT be shown or counted as an app or as an app's settings. Modules of the `windows-settings` tier SHALL be shown under the heading "Windows settings". Modules of a tier that the GUI does not know SHALL be shown under the heading "Other settings" and SHALL NOT be dropped.

#### Scenario: Windows settings module
- **WHEN** the engine reports a settings module with the ID `windows-settings.keyboard`
- **THEN** the GUI shows it under "Windows settings" with its engine display name
- **AND** it does not appear among app settings

#### Scenario: Unknown tier
- **WHEN** the engine reports a settings module whose tier is neither `apps` nor `windows-settings`
- **THEN** the GUI shows it under "Other settings"
- **AND** it does not appear among app settings

### Requirement: Profile contents show Windows settings separately

The "What's inside" summary SHALL show settings that belong to no app in their own tab and count badge beside Apps and App settings, with counts taken from the engine's inspection rows. These rows SHALL NOT carry an association line, and they SHALL NOT be counted as unidentified app settings rows.

#### Scenario: Profile with Windows settings
- **WHEN** the inspection lists 41 app settings rows and 7 rows whose modules are of the `windows-settings` tier
- **THEN** the summary shows "41 app settings" and "7 Windows settings"
- **AND** the tabs read "App settings (41)" and "Windows settings (7)"
- **AND** no Windows settings row reads "Association could not be identified."

### Requirement: Restoring Windows settings is a separate explicit choice

The restore choice SHALL count app settings and settings that belong to no app separately. The settings selector SHALL list settings that belong to no app in their own group, with their own Select all control, and SHALL state that restoring them changes this PC's Windows preferences. No module in the group SHALL be selected by default. A module's entry count SHALL use the group's entry noun. When the user selects such a module, the GUI SHALL pass its full module ID to the engine's restore filter.

#### Scenario: Restore choice counts
- **WHEN** a profile offers 40 app settings modules and 7 Windows settings modules
- **THEN** the restore choice reads "This profile includes settings for 40 apps and 7 Windows settings"

#### Scenario: Selecting a Windows setting
- **WHEN** the user selects "Windows keyboard: repeat delay and rate" in the Windows settings group and applies
- **THEN** the engine receives `--restore-filter` with `windows-settings.keyboard`
- **AND** the group shows the module's two entries as "2 values", not as files

#### Scenario: Select all stays inside its group
- **WHEN** the user activates Select all in the Windows settings group
- **THEN** every Windows settings module is selected
- **AND** no app settings module changes its selection

### Requirement: Settings counts never mix the groups

Each count of settings modules in the setup preview, the setup results header and the capture results SHALL count app settings and settings that belong to no app separately, listed as "a, b and c". A settings filter chip SHALL count the rows that its filter shows.

#### Scenario: Preview with Windows settings
- **WHEN** a profile offers 40 app settings modules and 7 Windows settings modules, and 40 preview app rows carry settings
- **THEN** the preview headline reads "40 app settings and 7 Windows settings available"
- **AND** the settings filter chip reads "40 settings", and selecting it shows those 40 app rows

#### Scenario: Capture with Windows settings
- **WHEN** a capture includes 1 app settings module for a listed app and 2 Windows settings modules
- **THEN** the capture headline reads "1 app setting and 2 Windows settings captured"
- **AND** the settings filter chip reads "1 setting"

### Requirement: Setup results list Windows settings under their own heading

The setup results SHALL list the restore rows of settings that belong to no app under the group heading, after the app rows, using the same restore status mapping and the same single settings count as every other restore row. A `registry-set` row SHALL use "setting" in its fallback secondary text, and its hover title SHALL show its target without an empty source.

#### Scenario: Mixed Windows settings outcomes
- **WHEN** a run ends with Windows settings rows that are restored, already up to date and failed
- **THEN** those rows appear under "Windows settings"
- **AND** the header counts include them, for example "3 settings: 1 restored, 1 already up to date, 1 failed"
- **AND** the failed row reads "Couldn't restore this setting"
- **AND** no registry path appears as row text

### Requirement: Restore rows never show registry internals

A restore row SHALL use the engine's `label` for the restore entry, when present, after the module name. A `registry-set` row without a label SHALL show only the module name. A `registry-set` row SHALL NOT show its registry value name or its engine message inline; its hover title SHALL keep both.

#### Scenario: Labelled Windows setting
- **WHEN** a `registry-set` restore item for `windows-settings.keyboard` carries the label "Delay before a held key starts repeating"
- **THEN** its row reads "Windows keyboard: repeat delay and rate · Delay before a held key starts repeating"

#### Scenario: Windows setting from an engine without labels
- **WHEN** a `registry-set` restore item for `windows-settings.personalization` has no label and fails with an engine message that names a registry value type
- **THEN** its row reads "Windows theme: light or dark mode · Couldn't restore this setting"
- **AND** neither the registry value name nor the engine message appears as row text

### Requirement: Capture results list Windows settings under their own heading

The capture results SHALL list captured settings that belong to no app under the group heading, not under "Settings only — app installation not included". Per-module engine notes SHALL appear only behind the Details disclosure.

#### Scenario: Captured Windows settings
- **WHEN** a capture includes a captured `windows-settings.taskbar` module
- **THEN** it is listed under "Windows settings"
- **AND** it is not listed under "Settings only — app installation not included"

#### Scenario: Module note
- **WHEN** a captured Windows settings module carries an engine note
- **THEN** the note is shown only when the user opens Details with the show-details setting on
