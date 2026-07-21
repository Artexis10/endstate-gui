## ADDED Requirements

### Requirement: Config-restore rows are engine-named and jargon-free

The GUI SHALL present each config-restore progress event (`restore-item`) as a settings row whose primary text is the engine-provided module display name plus the target file basename (for example `Notepad++ · contextMenu.xml`). When no display name resolves, the GUI SHALL fall back to `<module-id> · <basename>`, deriving the module id from the restore item's module context or its `./configs/<module-id>/…` source path. The GUI SHALL NOT surface the raw engine copy-spec (`/copy:<source>-><target>`) as inline row text.

#### Scenario: Legacy copy-spec restore item

- **WHEN** the engine streams a legacy `restore-item` whose id is a raw `copy:<source>-><target>` spec and whose module field is empty
- **THEN** the row renders the module display name (or the source-path module id) plus the target file basename
- **AND** no `/copy:` or `<source>-><target>` text appears in the row

#### Scenario: Display name unresolved

- **WHEN** no engine display name resolves for the restore item's module
- **THEN** the row renders `<module-id> · <basename>` using the module id derived from the source path
- **AND** still never shows the raw copy-spec

### Requirement: Restore rows use restore verbs

The GUI SHALL label config-restore rows with restore-specific verbs — RESTORING (transitional), RESTORED, UP TO DATE, MISSING, and FAILED — and SHALL NOT label them with the app activity verb INSTALLING. Terminal skip and failure states SHALL surface a friendly, jargon-free reason as muted secondary text, preferring the engine-authored message when it is present and free of raw path/copy-spec text.

#### Scenario: Transitional restore row

- **WHEN** a `restore-item` event has status `restoring`
- **THEN** the row is labelled RESTORING
- **AND** it is not labelled INSTALLING

#### Scenario: Skipped restore row

- **WHEN** a `restore-item` event has status `skipped_up_to_date`
- **THEN** the row is labelled UP TO DATE
- **AND** a friendly secondary line explains that the existing file already matches the saved settings

### Requirement: One row per restore item across its lifecycle

The GUI SHALL key each restore item by a stable identity (the target path) so that its transitional and terminal events update a single row in place rather than appending a duplicate. The full raw `source→target` detail MAY appear only in a hover title or disclosure, never as inline row text.

#### Scenario: Transitional then terminal event

- **WHEN** a restore item emits `restoring` and then a terminal status for the same target
- **THEN** the feed shows exactly one row for that item
- **AND** the row's label transitions in place to the terminal status

#### Scenario: Raw detail on demand

- **WHEN** the user inspects a restore row's hover title or disclosure
- **THEN** the full `source→target` detail is available there
- **AND** it is absent from the inline row text

### Requirement: Produced artifact renders as a distinct completion line

The GUI SHALL render the produced-artifact event (the saved profile bundle) as a distinct, muted completion line — a SAVED marker with an artifact label and the engine-provided artifact filename — and SHALL NOT render it as an app-style status row. The produced artifact SHALL remain visible.

#### Scenario: Manifest artifact event

- **WHEN** the engine emits an `artifact` event for the captured bundle
- **THEN** the feed shows a distinct muted "Saved profile bundle" line with the artifact filename
- **AND** it does not read as a DETECTED app row
