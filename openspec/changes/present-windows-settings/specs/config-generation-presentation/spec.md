## MODIFIED Requirements

### Requirement: GUI Renders Engine-Owned Config Resolution Results

When an apply preview or completed apply envelope contains `configResolutions[]`, the GUI SHALL present every resolution's engine-authored `label`, `message`, nullable `remediation`, and terminal `status` without mapping or rewriting them, on a card or, for a row that folds into the quiet line, in the details of that line when the show-details setting is on. The GUI SHALL NOT derive compatibility from application versions, generations, target candidates, migration paths, module definitions, or reason codes. It MAY read `resolution`, `reason` and `status` only to choose how a row is presented, and SHALL NOT read message text for that choice. For a completed apply, the GUI SHALL present `configResolutions[]` only when the restore intent is "apps-and-settings", matching the preview path; an install-only apply SHALL NOT present configuration cards even when the envelope carries resolution data. The GUI SHALL NOT drop a row by terminal status: a folded row stays reachable in the details when the show-details setting is on. When the envelope omits configuration fields, the existing config-free presentation SHALL remain unchanged.

#### Scenario: Four distilled states are rendered from the engine

- **WHEN** the engine supplies direct, migrate, unknown or legacy-unverified, and incompatible rows with the labels Compatible, Will be upgraded, Compatibility unknown, and Not supported
- **THEN** the GUI displays those supplied labels and messages verbatim, on a card or in the details of the quiet line
- **AND** does not reconstruct them from each row's resolution value

#### Scenario: Folded rows keep their engine copy in the details

- **WHEN** the engine supplies a legacy-unverified row with the label Compatibility unknown and shows details is on
- **THEN** the details of the quiet line show that label, the row's engine message and its engine remediation verbatim

#### Scenario: Completed rollback result remains engine-owned

- **WHEN** the final envelope reports `status: "rolled_back"` or `status: "rollback_failed"`
- **THEN** the GUI displays that terminal status with the engine's message and remediation
- **AND** does not replace the primary failure reason with a GUI-authored rollback classification

#### Scenario: Config-free input keeps the existing view

- **WHEN** an apply envelope omits configuration-resolution fields
- **THEN** the GUI does not render an empty configuration-resolution section
- **AND** existing application preview and result behavior remains available

#### Scenario: Install-only apply presents no configuration cards

- **WHEN** a completed apply envelope carries `configResolutions[]` but the restore intent is "apps-only"
- **THEN** the GUI does not present any configuration resolution cards or quiet line
- **AND** the application result summary remains available

### Requirement: GUI Groups Redundant Config Resolutions

The GUI SHALL group the configuration resolutions that need the person by the composite key of `resolution`, `label`, and `message`, and render one card per group. A group card SHALL show the engine `message` as its heading, the engine `label` and a GUI-authored count of member settings as context, the member module display names, each distinct engine `remediation` once, and each member's terminal `status`. The only GUI-authored text SHALL be the count and structural section labels; every other displayed sentence SHALL be engine copy rendered verbatim. Resolutions with distinct engine `message` values SHALL fall into distinct groups and SHALL NOT be merged. A row whose `reason` is `ambiguous_target_instance` SHALL be excluded from grouping and rendered as an individual decision card, whatever its `resolution`. A `direct` resolution group SHALL render as a single quiet line without card chrome or a status tag; a `direct` resolution whose status is `failed`, `rolled_back` or `rollback_failed`, or whose `reason` is set and is not one of the four reasons that need nothing from the person, SHALL render in a card, because a failure is not a confirmation.

#### Scenario: Repeated same-verdict rows collapse into one card

- **WHEN** the engine supplies ten `incompatible` rows sharing one label and one message
- **THEN** the GUI renders a single group card for those rows
- **AND** shows the shared engine message once and a count of ten settings

#### Scenario: Distinct engine messages stay in separate cards

- **WHEN** two rows share a resolution and label but carry different engine messages
- **THEN** the GUI renders one card per message
- **AND** does not merge the distinct engine copy

#### Scenario: Ambiguous target rows stay individual

- **WHEN** rows report `ambiguous_target_instance`
- **THEN** the GUI renders each such row as its own card with its own target selector
- **AND** does not collapse them into a group even when their label and message match

#### Scenario: Direct confirmations render as a quiet line

- **WHEN** the engine supplies `direct` "Compatible" rows that did not fail
- **THEN** the GUI renders a single muted line for that group
- **AND** shows no card border and no terminal status tag

#### Scenario: A failed direct result is a card

- **WHEN** the engine supplies a `direct` row with status `failed`
- **THEN** the GUI renders that row in a card with its terminal status
- **AND** does not fold it into the quiet "Compatible" line

#### Scenario: Grouped provenance stays behind one disclosure

- **WHEN** a group card renders and the show-details setting is on
- **THEN** the GUI exposes one "Configuration details" disclosure containing a section per member
- **AND** each member section keeps its portable provenance collapsed until requested

#### Scenario: Legacy warning stays visible before execution

- **WHEN** a `legacy_unverified` row did not fail
- **THEN** the quiet line that counts it is visible before execution without opening any disclosure
- **AND** the engine-authored warning label, message, and remediation are in the details of that line when the show-details setting is on

### Requirement: Migration Events Are Transient Engine-Authored Progress

During apply, the GUI SHALL display the message of every `config-migration` event, and the message of every `config-resolution` event that needs the person, as transient progress in stream order. It SHALL fold the other `config-resolution` events into one quiet line counted from the events seen so far, with the same rule and the same copy as the final list, and SHALL NOT announce each change of that count to assistive technology. A `config-resolution` event carries no terminal status, because the engine emits it before it changes the set, and the engine reports some failures only as a `reason` on that event; the rule SHALL therefore decide from `resolution` and `reason`, with the same result as in the final list for the same `resolution` and `reason`. In a run, the progress list SHALL show the quiet line alone, without a details disclosure; the preview and the results keep each folded row's engine copy in the details. The list of rows SHALL stay mounted as a polite live region even when it holds no row, so the first row that needs the person is announced. It SHALL NOT interpret migration operations or translate staging, edge, validation, commit, or rollback into final outcomes.

#### Scenario: Forward migration progress stays ordered

- **WHEN** events report staging, multiple migration edges, validation, and commit
- **THEN** the GUI shows the engine-authored messages in event order
- **AND** uses no GUI-authored migration result in place of the final envelope

#### Scenario: Failure and rollback remain visible

- **WHEN** migration events report a failure followed by rollback progress
- **THEN** the GUI shows both engine-authored messages while the run is active
- **AND** waits for the command envelope to determine the terminal status

#### Scenario: A long restore does not draw one box for each setting

- **WHEN** 48 `config-resolution` events stream in, 47 `legacy_unverified` and 1 `unknown` with reason `target_not_detected`, together with 1 `incompatible` event
- **THEN** the live list shows one row for the `incompatible` event and one quiet line for the other 48
- **AND** the quiet line is outside the live region that assistive technology announces

## ADDED Requirements

### Requirement: GUI Folds Config Resolutions That Need Nothing From The Person

The GUI SHALL show a card only for a resolution that needs the person, and SHALL fold every other resolution except a non-failed `direct` into one quiet line. A resolution needs the person when any of these holds: its `reason` is `ambiguous_target_instance`; its `resolution` is `migrate` or `incompatible`; its `status` is `failed`, `rolled_back` or `rollback_failed`; its `reason` is set and is anything other than `target_not_detected`, `already_up_to_date`, `restore_filtered` or `restore_not_enabled`, for every kind of resolution and including a new reason; or its `resolution` is `unknown` and it has no `reason`. The engine reports some failures only as such a `reason`, for example `target_collision` or `backup_failed`, with no failed status. A `legacy_unverified` resolution with no `reason` or one of those four reasons, and an `unknown` resolution with one of those four reasons, SHALL fold. A `direct` resolution with no `reason` or one of those four reasons stays a quiet confirmation. The GUI SHALL decide from `resolution`, `reason` and `status` only, never from message text, and the preview, the live list while Apply runs, and the results SHALL use the same rule.

The quiet line SHALL be the compatibility notice shown before execution: it SHALL be visible without opening any disclosure, in the preview before Apply and in the results. It SHALL read "Compatibility not checked for" followed by a count of the distinct modules of the folded resolutions, named by settings group (for example "40 app settings and 7 Windows settings"), and then a sentence on why. That sentence SHALL claim only what holds: "They were saved before Endstate checked versions." when every folded resolution is `legacy_unverified` ("It was" for one), "N of them were saved before Endstate checked versions." when only some are, and no such sentence when none is. When no resolution needs the person, the section SHALL be that one line, with no heading. When every resolution needs the person, the section SHALL hold the cards only.

With the show-details setting on, the line SHALL have a "Configuration details" disclosure that shows each distinct engine label once, each distinct engine message once with its distinct remediation, and under each message the folded settings it covers, each with its terminal status and portable provenance. The details SHALL NOT repeat a label or a message.

#### Scenario: A real host bundle folds into one line

- **WHEN** a dry run returns 48 resolutions in three groups: 24 `legacy_unverified` with no reason, 23 `legacy_unverified` with reason `already_up_to_date`, and 1 `unknown` with reason `target_not_detected`, and every row is planned or skipped
- **THEN** the section holds one line, for example "Compatibility not checked for 41 app settings and 7 Windows settings. 47 of them were saved before Endstate checked versions."
- **AND** no card and no repeated heading shows

#### Scenario: A row that needs the person stays a card beside the line

- **WHEN** the same run also contains one `incompatible` row and one `ambiguous_target_instance` row
- **THEN** the `incompatible` row shows in its card and the ambiguous row shows in its own card with its target selector
- **AND** the quiet line follows the cards and counts only the folded modules

#### Scenario: An unrecognised reason fails open

- **WHEN** an `unknown` row carries the reason `target_collision`, `app_running`, or a reason the GUI has not seen
- **THEN** the GUI shows that row in a card
- **AND** does not fold it into the quiet line

#### Scenario: A failure reported only as a reason is never folded or confirmed

- **WHEN** a row of any kind carries a reason that is not one of the four, with no failed status, for example `legacy_unverified` with `target_collision`, or `direct` with `backup_failed` or `journal_intent_failed`
- **THEN** the GUI shows that row in a card, and in the live list as a row with its engine message
- **AND** the quiet line counts only the rows that fold, and no muted "Compatible" line stands for the failed `direct` row

#### Scenario: A failed row is never folded

- **WHEN** a `legacy_unverified` row ends with status `failed`
- **THEN** the GUI shows that row in a card with its engine message and status

#### Scenario: Counts come from the data

- **WHEN** two folded rows share one module
- **THEN** the line counts that module once
- **AND** a Windows settings module is counted apart from app settings

#### Scenario: Details list each message once

- **WHEN** show details is on and the folded rows carry two distinct engine messages
- **THEN** the disclosure shows each message once, with the engine label once above them
- **AND** each message lists the settings it covers
