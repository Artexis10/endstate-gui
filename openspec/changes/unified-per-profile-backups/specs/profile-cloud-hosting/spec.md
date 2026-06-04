## ADDED Requirements

### Requirement: Profiles are hosted as id-addressed cloud backups

A local profile SHALL be hosted as its own cloud backup identified by the backend-assigned backup **id**. The GUI SHALL persist a profile-key → backupId mapping in settings (`profileBackupIds`). The profile **name** is a per-user-unique human label only; it SHALL NOT be used as the identity for resolving or matching a backup.

#### Scenario: First host of a profile creates a new backup
- **WHEN** the user hosts a profile that has no entry in `profileBackupIds`
- **THEN** the GUI invokes `endstate backup push --profile <path> --name <profileName>` with no `--backup-id`
- **AND** on success records `profileBackupIds[<profileKey>] = <returned backupId>`

#### Scenario: Re-hosting a profile adds a version to its own backup
- **WHEN** the user hosts a profile that already has a `profileBackupIds` entry
- **THEN** the GUI invokes `endstate backup push --profile <path> --backup-id <mappedId>`
- **AND** the push creates a new version of that same backup rather than a new backup

#### Scenario: A profile rename does not orphan its backup
- **WHEN** a profile whose `profileBackupIds` entry is preserved is hosted again under a new label
- **THEN** the GUI targets the same backup by its mapped id
- **AND** the existing backup is versioned (its label may update), not duplicated

### Requirement: Per-profile cloud badge derives from the id-mapping

The Setup-flow per-profile "Backed up / Local only" indicator SHALL be derived from `profileBackupIds`, verified against the current `backup list` **by id**. It SHALL NOT be derived by matching the profile name against backup names.

#### Scenario: Hosted profile shows Backed up
- **WHEN** a profile has a `profileBackupIds` entry whose id is present in `backup list`
- **THEN** the row renders the "Backed up" state (not "Local only")

#### Scenario: Badge updates immediately after a successful host
- **WHEN** a previously local-only profile is hosted successfully
- **THEN** the cloud index is refreshed and the row flips to "Backed up" without requiring a reload

#### Scenario: Stale mapping falls back to Local only
- **WHEN** a profile has a `profileBackupIds` entry whose id is absent from `backup list` (e.g. deleted in the cloud)
- **THEN** the row renders "Local only"

#### Scenario: Name collisions do not cross-contaminate badges
- **WHEN** two distinct profiles share the same label but map to different backup ids
- **THEN** each row's badge reflects only its own mapped id's presence in `backup list`

### Requirement: Automatic backup unifies onto the captured profile

After a capture, automatic backup SHALL push the captured profile under that profile's own name/key (recording its backup id in `profileBackupIds`), rather than under a fixed `"This computer"` backup. A silent automatic backup and an explicit host of the same profile SHALL target the same backup/version stream.

#### Scenario: Auto-backup creates the profile's backup on first capture
- **WHEN** auto-backup runs for a captured profile with no `profileBackupIds` entry
- **THEN** it pushes with `--name <profileName>` (no `--backup-id`) and records the returned id under the profile's key

#### Scenario: Auto-backup versions the same backup as an explicit host
- **WHEN** a profile already hosted (mapped id present) is auto-backed-up after a later capture
- **THEN** auto-backup pushes with `--backup-id <mappedId>`, adding a version to the same backup the user sees as hosted

### Requirement: Engine push contract — create when named without an id

The GUI relies on the engine creating a NEW backup when `backup push` is given `--name` with no `--backup-id`. The engine SHALL NOT append the push to a pre-existing backup (e.g. `backups[0]`) in this case. (Implemented in the `endstate` repo; this requirement records the contract the GUI depends on.)

#### Scenario: Named push with no id creates a distinct backup
- **WHEN** `endstate backup push --profile <p> --name <label>` is invoked and the account already has one or more backups
- **THEN** the engine creates a new backup labeled `<label>` and returns its new id
- **AND** does not add a version to any existing backup

### Requirement: Non-destructive migration of existing backup state

Introducing the unified model SHALL NOT delete, rename, or invalidate existing backups, versions, or `profileBackupIds` entries. The legacy `"This computer"` backup SHALL remain listed and restorable.

#### Scenario: Legacy backup survives the change
- **WHEN** an account has a pre-existing `"This computer"` backup before the change ships
- **THEN** after the change it still appears in `backup list` and can be restored
- **AND** existing `profileBackupIds` entries continue to resolve to their backups
