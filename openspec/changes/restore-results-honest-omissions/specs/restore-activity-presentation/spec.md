## MODIFIED Requirements

### Requirement: Restore rows use restore verbs

The GUI SHALL label config-restore rows with restore-specific labels and SHALL NOT label them with the app activity verb INSTALLING. In a run that changes the machine, the labels SHALL be RESTORING (transitional), RESTORED, UP TO DATE, NOT IN SETUP and FAILED. `skipped_missing_source` SHALL render neutral (muted) with the long label "Not included in the saved setup", because the engine emits it only for an optional entry whose source the saved setup does not contain. FAILED SHALL remain error-coloured. Terminal skip and failure states SHALL surface a friendly, jargon-free reason as muted secondary text, preferring the engine-authored message when it is present and free of raw path or copy-spec text. Verify MISSING (an app that is not installed) is a different meaning and SHALL keep its warn mapping.

#### Scenario: Transitional restore row

- **WHEN** a `restore-item` event has status `restoring` in a run that changes the machine
- **THEN** the row is labelled RESTORING
- **AND** it is not labelled INSTALLING

#### Scenario: Skipped restore row

- **WHEN** a `restore-item` event has status `skipped_up_to_date`
- **THEN** the row is labelled UP TO DATE
- **AND** a friendly secondary line explains that the existing file already matches the saved settings

#### Scenario: Optional settings file the saved setup does not contain

- **WHEN** a `restore-item` event has status `skipped_missing_source`
- **THEN** the row is labelled NOT IN SETUP in a neutral colour, not a warning colour
- **AND** the secondary line is the engine message when it is clean

#### Scenario: Real restore failure

- **WHEN** a `restore-item` event has status `failed` in a run that changes the machine
- **THEN** the row is labelled FAILED in the error colour
- **AND** the results header reads "Setup completed with errors"

## ADDED Requirements

### Requirement: Preview restore rows use preview language

The GUI SHALL take the dry-run state of a restore row from the run's dry-run flag: the flag the run was started with while events stream, and the envelope's `data.dryRun` once the run ends. In a dry run, a `restored` item SHALL be labelled TO RESTORE ("Would restore") and a `restoring` item CHECKING. A preview SHALL NOT show RESTORED, and its counts SHALL read "would be restored".

#### Scenario: Dry run with a restorable setting

- **WHEN** a dry-run apply streams a `restore-item` with status `restored`
- **THEN** the row is labelled TO RESTORE
- **AND** no restore row or count on the results surface reads RESTORED or "restored" without "would be"

#### Scenario: Dry run with a failed setting

- **WHEN** a dry-run apply ends with a `restore-item` of status `failed`
- **THEN** the results header reads "Preview completed with errors — nothing was installed"
- **AND** it does not read "Setup completed with errors" or the plain preview title

### Requirement: Settings counts equal the restore rows

The GUI SHALL derive every settings count it shows (results header, settings chip, progress line and result modal) from one source: the reconciled restore rows, one per restore target. Counts SHALL list restored (or would be restored), already up to date, not in saved setup and failed separately, omitting zero counts. The GUI SHALL NOT read or synthesise a restore summary from the apply envelope, and SHALL NOT count restore rows as apps.

#### Scenario: Mixed restore run

- **WHEN** a run ends with one row each of restored, skipped_up_to_date, skipped_missing_source and failed
- **THEN** the header reads "4 settings: 1 restored, 1 already up to date, 1 not in saved setup, 1 failed"
- **AND** the results list shows exactly those four restore rows
- **AND** the "without settings" app count does not include any restore row
