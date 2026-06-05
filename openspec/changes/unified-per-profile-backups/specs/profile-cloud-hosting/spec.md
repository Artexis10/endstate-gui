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

### Requirement: Automatic backup labels this machine's backup with its hostname

After a capture, automatic backup SHALL push to a single stable per-machine backup (local key `auto:this-computer`) and SHALL label that backup with the machine's **hostname** rather than a generic `"This computer"` string, so a user with multiple machines can distinguish their auto-backups in the backup list. The label is best-effort and SHALL fall back to `"This computer"` when the hostname cannot be determined. The local key is unchanged so existing auto-backups continue to version the same backup (non-destructive).

> Full per-profile *unification* (a silent auto-backup and an explicit host of the **same** profile converging on one backup) is DEFERRED. Captures have no stable per-profile identity yet — the capture artifact is a timestamped temp file and the capture envelope carries no machine/profile name, and auto-backup runs before the profile is named/saved. Re-keying would create a new backup per capture. Tracked for a follow-up once the engine emits a stable capture/profile identity (the deferred capture-naming Open Question in `design.md`).

#### Scenario: First auto-backup labels the backup with the hostname
- **WHEN** auto-backup runs on a machine with no `auto:this-computer` entry in `profileBackupIds`
- **THEN** it pushes with `--name <hostname>` (no `--backup-id`) and records the returned id under `auto:this-computer`

#### Scenario: Later captures version the same machine backup
- **WHEN** a machine already has an `auto:this-computer` entry
- **THEN** auto-backup pushes with `--backup-id <mappedId>`, adding a version to the same backup

#### Scenario: Hostname unavailable falls back gracefully
- **WHEN** the hostname cannot be determined (e.g. a non-Tauri runtime or the command errors)
- **THEN** the label falls back to `"This computer"` and the push still succeeds

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
