## ADDED Requirements

### Requirement: Every listed profile offers an in-app contents summary

The Set up flow SHALL render a **What's inside** affordance on every profile card, opening a summary of that profile's contents. The affordance SHALL be reachable without renaming the bundle, opening an external archiver, or leaving Endstate.

#### Scenario: Affordance is present on each profile card
- **WHEN** the Set up flow lists one or more profiles
- **THEN** each profile card exposes a **What's inside** control naming that profile

#### Scenario: Summary opens for the chosen profile
- **WHEN** the user activates **What's inside** on a profile card
- **THEN** a dialog opens describing that profile's contents
- **AND** the manifest read is the one belonging to that card's profile

#### Scenario: Summary is closed until requested
- **WHEN** the Set up flow first renders its profile list
- **THEN** no contents summary is shown

### Requirement: Inspecting a profile changes nothing

Opening the contents summary SHALL be read-only. The GUI SHALL NOT select the profile, request a preview, invoke the engine, or modify the machine as a result of inspection.

#### Scenario: Inspection does not start a run
- **WHEN** the user activates **What's inside** on a profile card
- **THEN** the profile is not selected
- **AND** no preview is requested
- **AND** no engine command is invoked

### Requirement: Summary reports what the profile will apply

The summary SHALL report the capture timestamp when the manifest records one, the number of applications and their labels, and the settings modules the profile carries with the number of configuration files each contributes. Counts SHALL be derived from the manifest and SHALL NOT be fabricated or inferred.

#### Scenario: Apps and settings are counted
- **WHEN** a profile manifest declares applications and captured settings
- **THEN** the summary states how many apps and how many settings modules the profile contains
- **AND** each settings module shows how many configuration files it contributes

#### Scenario: Applications are named
- **WHEN** a manifest application entry carries a display name
- **THEN** the summary lists the application by that display name
- **AND** an entry without a display name is listed by its package ref

#### Scenario: Capture timestamp is shown when recorded
- **WHEN** the manifest records a capture timestamp
- **THEN** the summary shows when the profile was captured

#### Scenario: Capture timestamp is absent
- **WHEN** the manifest records no capture timestamp
- **THEN** the summary states that no capture date is recorded
- **AND** no date is invented

### Requirement: Settings-free and app-free profiles read as normal outcomes

A profile carrying no settings, or no applications, SHALL be described in calm, explanatory language. The GUI SHALL NOT present either case as a warning or an error.

#### Scenario: Install-only profile
- **WHEN** a profile declares applications but no captured settings
- **THEN** the summary states that the profile installs apps only and includes no settings
- **AND** no warning or error treatment is applied

#### Scenario: Settings-only profile
- **WHEN** a profile declares captured settings but no applications
- **THEN** the summary states that the profile carries settings only and installs no apps

### Requirement: The summary never exposes raw provenance ids

The summary SHALL NOT use a module id, capture id, config set id, or file path as user-facing label text. A settings module whose friendly name cannot be resolved SHALL remain counted but unnamed. Those identifiers and the manifest path SHALL be exposed only through the **Configuration details** disclosure, consistent with `config-generation-presentation`.

#### Scenario: Unresolvable module stays unnamed
- **WHEN** a settings module has no display name resolvable from its module snapshot, the application list, or its capture package ref
- **THEN** the module is still included in the settings count
- **AND** its module id does not appear as a label in the summary

#### Scenario: Identifiers live behind the disclosure
- **WHEN** the show-details setting is on and the user opens **Configuration details**
- **THEN** the module ids, manifest version, and manifest path are shown

#### Scenario: Disclosure is absent by default
- **WHEN** the show-details setting is off
- **THEN** no **Configuration details** disclosure is offered
- **AND** no module id or file path appears anywhere in the summary

### Requirement: The summary reads only extracted profile files

The GUI SHALL build the summary from the profile's already-extracted `manifest.jsonc` and, when present, its sibling module snapshots under `provenance/modules/`. The GUI SHALL NOT open the `.endstate` zip container and SHALL NOT invoke the engine to produce the summary. A snapshot path that does not resolve under `provenance/modules/` SHALL NOT be read.

#### Scenario: Module display names come from the bundle snapshot
- **WHEN** a manifest-v2 config capture references a module snapshot inside the bundle
- **THEN** the settings module is labeled with the display name that snapshot declares

#### Scenario: Missing snapshot degrades without failing
- **WHEN** a referenced module snapshot cannot be read
- **THEN** the summary still renders
- **AND** the settings module falls back to the owning application's name or its capture package ref

#### Scenario: Unsafe snapshot path is refused
- **WHEN** a manifest records a module snapshot path outside `provenance/modules/`
- **THEN** that path is not read

#### Scenario: Unreadable manifest is surfaced
- **WHEN** the profile manifest cannot be read or parsed
- **THEN** the summary reports that the profile could not be read
- **AND** does not present an empty profile as a valid summary
