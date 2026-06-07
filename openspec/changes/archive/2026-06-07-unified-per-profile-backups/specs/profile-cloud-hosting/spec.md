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

#### Scenario: Re-host after the mapped backup was deleted creates a fresh backup
- **WHEN** a profile has a `profileBackupIds` entry whose id is NOT present in the live `backup list` (deleted here or on another machine)
- **THEN** the GUI pushes with `--name` and no `--backup-id`, creating a new backup
- **AND** it SHALL NOT push `--backup-id <deletedId>` (which the engine would reject)

### Requirement: Deleting a backup clears its local mapping

When a backup is deleted, the GUI SHALL remove every `profileBackupIds` entry that points at the deleted backup id, so a later host of that profile creates a fresh backup rather than targeting a dead id.

#### Scenario: Deleting a backup prunes the mapping
- **WHEN** the user deletes a backup that a profile is mapped to
- **THEN** the GUI removes that profile's `profileBackupIds` entry
- **AND** the profile's row reverts to "Local only"

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

### Requirement: Automatic backup remains a single stable per-machine backup

After a capture, automatic backup SHALL continue to push to a single stable per-machine backup, keyed locally by `auto:this-computer`, so repeated captures version the same backup (non-destructive). This change SHALL NOT alter that behaviour.

The human **label** for this machine backup is OWNED BY THE ENGINE, not the GUI: the GUI SHALL NOT fabricate a device name (e.g. by reading the OS hostname) per the thin-presentation-layer contract. Improving the default label from the generic `"This computer"` to a real device label is tracked as a separate **engine** change (the engine defaults a backup's name to a device label when `--name` is omitted), after which the GUI displays whatever name the engine returns.

> Full per-profile *unification* (a silent auto-backup and an explicit host of the **same** profile converging on one backup) is DEFERRED for the same reason the engine must own the device label: captures have no stable per-profile/machine identity yet — the capture artifact is a timestamped temp file and the capture envelope carries no machine/profile name, and auto-backup runs before the profile is named/saved. Both the device label and the stable identity belong in the engine; tracked as a follow-up (the deferred capture-naming Open Question in `design.md`).

#### Scenario: Auto-backup keeps versioning one machine backup
- **WHEN** auto-backup runs after a later capture on a machine that already has an `auto:this-computer` entry
- **THEN** it pushes with `--backup-id <mappedId>`, adding a version to the same backup (not a new one)

#### Scenario: GUI does not fabricate the device label
- **WHEN** automatic backup creates this machine's backup
- **THEN** the GUI does not derive the label from OS data; the label default is the engine's responsibility

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
