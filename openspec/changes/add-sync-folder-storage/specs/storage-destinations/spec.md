# Storage Destinations

Setup artifacts may be stored in the default Documents folder, a discovered local
sync folder, or any user-entered folder. Folder storage remains distinct from Hosted
Backup.

## ADDED Requirements

### Requirement: Storage destinations use a typed persisted shape

The GUI SHALL persist a selected folder as
`{ kind: "folder", path: "<selected path>" }`. The GUI SHALL represent the existing
default `Documents\Endstate\Setups` location as a null destination. Runtime profile
directory resolution SHALL use the typed destination consistently for discovery,
save, import, rename, delete, and setup.

#### Scenario: Default Documents storage

- **GIVEN** no storage destination is persisted
- **WHEN** the GUI resolves the profiles directory
- **THEN** it uses the existing `Documents\Endstate\Setups` default

#### Scenario: Folder destination selected

- **GIVEN** a folder destination with path `D:\Setups`
- **WHEN** the GUI reads or writes setup artifacts
- **THEN** every profile operation uses `D:\Setups`

#### Scenario: Selected folder is temporarily unavailable

- **GIVEN** a persisted folder destination that cannot currently be accessed
- **WHEN** a profile operation uses it
- **THEN** the existing filesystem error is surfaced
- **AND** the GUI does not silently fall back to the default Documents folder

### Requirement: Legacy custom directories migrate without relocation

The GUI SHALL migrate a non-empty legacy `customProfilesDirectory` string to a folder
destination with the exact same path. An empty or absent legacy value SHALL migrate to
the default null destination. Normalized settings SHALL no longer persist the legacy
field.

#### Scenario: Existing custom path

- **GIVEN** stored settings contain
  `customProfilesDirectory: "C:\Users\me\OneDrive\Endstate"`
- **AND** no typed storage destination exists
- **WHEN** settings are loaded
- **THEN** the destination is
  `{ kind: "folder", path: "C:\Users\me\OneDrive\Endstate" }`
- **AND** subsequent normalized persistence omits `customProfilesDirectory`

#### Scenario: Existing default path selection

- **GIVEN** stored settings contain an empty `customProfilesDirectory`
- **AND** no typed storage destination exists
- **WHEN** settings are loaded
- **THEN** the destination is null

#### Scenario: Typed destination takes precedence

- **GIVEN** stored settings contain both a valid typed destination and a legacy string
- **WHEN** settings are loaded
- **THEN** the typed destination is used
- **AND** the legacy string is removed from normalized persistence

### Requirement: Storage location is separate from engine configuration

The Settings page SHALL present a dedicated **Storage location** card rather than
placing setup storage under Engine Configuration. The card SHALL offer the default
Documents location, every detected sync-folder account, and a custom folder option.
The custom option SHALL support both free-text entry and a native folder picker.

#### Scenario: User enters an arbitrary folder

- **WHEN** the user enters a Proton Drive, Nextcloud, NAS, mounted-share, or other
  folder path
- **THEN** the GUI persists it as a folder destination
- **AND** does not require the folder to match a recognized provider

#### Scenario: User browses for a folder

- **WHEN** the user chooses **Browse** and selects a directory
- **THEN** the selected directory is shown in the field
- **AND** is persisted as a folder destination

#### Scenario: Folder picker is cancelled

- **WHEN** the user cancels the native folder picker
- **THEN** the existing destination remains unchanged

#### Scenario: OneDrive Known Folder Move redirects Documents

- **GIVEN** the resolved default Documents directory is below a detected OneDrive root
- **WHEN** the Storage location card renders
- **THEN** the default choice is labelled **Documents (default)**
- **AND** it indicates that the location is synced with OneDrive
- **AND** it is not described as **This device** or as local-only
- **AND** selecting it continues to persist a null default destination

### Requirement: Windows sync clients are discovered locally

The GUI SHALL discover OneDrive, Google Drive, and Dropbox folder roots using local
Windows state only. Discovery SHALL NOT authenticate to a provider, call a provider
API, or read provider credentials.

#### Scenario: Personal and work OneDrive coexist

- **GIVEN** `OneDriveConsumer` and `OneDriveCommercial` identify different folders
- **WHEN** discovery runs
- **THEN** both folders are returned as separate choices

#### Scenario: Duplicate OneDrive variables

- **GIVEN** two OneDrive environment variables identify the same Windows path
- **WHEN** discovery runs
- **THEN** that path is offered only once

#### Scenario: OneDrive environment variables are absent

- **GIVEN** the OneDrive environment variables are absent
- **AND** a OneDrive account registry subkey contains `UserFolder`
- **WHEN** discovery runs
- **THEN** that registry folder is returned as a OneDrive choice

#### Scenario: Multiple OneDrive business accounts use registry fallbacks

- **GIVEN** `Business1` and `Business2` account subkeys contain different
  `UserFolder` values
- **WHEN** discovery runs
- **THEN** both work folders are returned as separate choices

#### Scenario: Multiple Google Drive accounts

- **GIVEN** the `PerAccountPreferences` value under `HKCU\Software\Google\DriveFS`
  lists two accounts mounted at `G` and `H`
- **WHEN** discovery runs
- **THEN** `G:\My Drive` and `H:\My Drive` are returned as separate choices
- **AND** they are labelled `Google Drive (G:)` and `Google Drive (H:)`

#### Scenario: Google Drive account mirrored to a folder

- **GIVEN** a Google Drive account's mount is the folder `D:\Sync\Work Drive`
- **WHEN** discovery runs
- **THEN** `D:\Sync\Work Drive\My Drive` is returned, labelled
  `Google Drive (Work Drive)`

#### Scenario: Google Drive with no signed-in account

- **GIVEN** the `PerAccountPreferences` value lists no accounts
- **WHEN** discovery runs
- **THEN** Google Drive is reported as not detected, not as an error

#### Scenario: Personal and business Dropbox coexist

- **GIVEN** Dropbox `info.json` contains both `personal.path` and `business.path`
- **WHEN** discovery runs
- **THEN** both folders are returned as separate choices

#### Scenario: Dropbox metadata uses the roaming location

- **GIVEN** `%LOCALAPPDATA%\Dropbox\info.json` is absent
- **AND** `%APPDATA%\Dropbox\info.json` contains a valid personal or business path
- **WHEN** discovery runs
- **THEN** the roaming metadata path is used

#### Scenario: Provider data is malformed

- **GIVEN** one provider's local metadata cannot be parsed
- **WHEN** discovery runs
- **THEN** that provider reports an error state
- **AND** its provider row remains visible with a safe reason
- **AND** valid folders from other providers remain available

#### Scenario: Non-Windows runtime

- **GIVEN** the GUI runs outside the Windows desktop runtime
- **WHEN** sync-folder discovery is requested
- **THEN** provider discovery reports unsupported
- **AND** default and custom folder choices remain available

### Requirement: Provider choices remain visible when not detected

The Storage location card SHALL keep OneDrive, Google Drive, and Dropbox visible when
no corresponding folder is detected or provider metadata cannot be parsed. A
not-detected provider SHALL direct the user to install or set up its desktop app. A
provider error SHALL show a safe reason without exposing raw registry or file content.

#### Scenario: Google Drive desktop app is absent

- **GIVEN** no Google Drive account folder is detected
- **WHEN** the Storage location card renders
- **THEN** Google Drive remains visible as not detected
- **AND** the UI gives desktop-app install or setup guidance

#### Scenario: Google Drive registry format changes

- **GIVEN** Google Drive per-account registry data cannot be parsed
- **WHEN** the Storage location card renders
- **THEN** Google Drive remains visible in an error state
- **AND** the row explains that its local configuration could not be read
- **AND** raw registry content is not displayed

### Requirement: One-click provider choices use an Endstate subfolder

Selecting a discovered provider root SHALL persist a folder destination at
`<sync root>\Endstate`. Discovery alone SHALL NOT create the directory. Existing write
and import boundaries SHALL create it when needed.

#### Scenario: OneDrive selected

- **GIVEN** OneDrive is detected at `C:\Users\me\OneDrive`
- **WHEN** the user selects it
- **THEN** the persisted folder destination path is
  `C:\Users\me\OneDrive\Endstate`

#### Scenario: Endstate subfolder not created yet

- **GIVEN** the selected destination is `C:\Users\me\OneDrive\Endstate`
- **AND** `C:\Users\me\OneDrive` exists but `Endstate` inside it does not
- **WHEN** the setup list loads
- **THEN** the list is empty and says Endstate creates the folder on the first save
- **AND** no "Couldn't read your profiles folder" error is shown

#### Scenario: Destination parent missing

- **GIVEN** the selected destination's parent folder or drive does not exist, or
  the destination cannot be read
- **WHEN** the setup list loads
- **THEN** the list shows the "Couldn't read your profiles folder" error

### Requirement: Discovery does not download online-only setups

Before reading setup contents or metadata, the GUI SHALL determine whether each
candidate is available locally. An online-only candidate SHALL remain visible by
filename, marked **Online-only**, and disabled with guidance to make it available
locally in the sync app. Discovery SHALL NOT validate the candidate, read its metadata
sidecar, or otherwise request hydration merely to populate the setup list.

#### Scenario: Online-only bundle is listed without hydration

- **GIVEN** `workstation.endstate` has an online-only or recall-on-access filesystem
  attribute
- **WHEN** setup discovery runs
- **THEN** the setup list shows `workstation.endstate` as **Online-only**
- **AND** the item cannot be selected for setup
- **AND** Endstate does not open the bundle or its metadata

#### Scenario: Online-only setup becomes local

- **GIVEN** an online-only setup was previously shown as unavailable
- **WHEN** the sync client makes it local and setup discovery refreshes
- **THEN** Endstate validates it normally
- **AND** a valid setup becomes selectable

### Requirement: Saves are transactional under sync-client contention

The GUI SHALL commit a saved setup through an undiscoverable staging entry and an
atomic native rename or replacement. If the final setup or staging entry is locked,
the save SHALL fail with a visible storage-busy error. The previous complete setup
SHALL remain unchanged, or a new final setup SHALL remain absent. No partial setup
SHALL appear in discovery.

#### Scenario: Sync client locks the final setup

- **GIVEN** the sync client holds a sharing lock on an existing setup
- **WHEN** the user saves to that setup path
- **THEN** the save fails with a visible error that the storage location is busy
- **AND** the existing setup remains byte-for-byte unchanged
- **AND** no partial setup appears in the setup list

#### Scenario: Sync client locks the staging entry

- **GIVEN** a complete setup was written to the undiscoverable staging entry
- **AND** the sync client locks that staging entry before commit
- **WHEN** Endstate attempts to commit the save
- **THEN** the save fails with a visible storage-busy error
- **AND** the final setup remains unchanged or absent
- **AND** the staging entry is excluded from discovery
- **AND** cleanup is retried on the next directory access if immediate removal is
  blocked

#### Scenario: Transactional save succeeds

- **WHEN** the complete staging entry is flushed, closed, and committed without a lock
- **THEN** the final path exposes the complete setup in one commit
- **AND** no staging entry remains

### Requirement: Provider conflict copies remain separate setups

The GUI SHALL treat every locally available, valid provider-created conflict copy as
a separate setup identified by its distinct path. Endstate SHALL NOT merge, delete,
overwrite, or select an authoritative copy. When labels would otherwise collide, the
GUI SHALL include filenames to distinguish them.

#### Scenario: Provider creates a valid conflict copy

- **GIVEN** a folder contains `setup.endstate` and
  `setup (conflicted copy).endstate`
- **AND** both are locally available and valid
- **WHEN** setup discovery runs
- **THEN** both files appear as separate setups
- **AND** the user can distinguish them by filename

#### Scenario: Conflict copy is online-only

- **GIVEN** a provider-created conflict copy is online-only
- **WHEN** setup discovery runs
- **THEN** it follows the online-only behavior
- **AND** Endstate does not hide, merge, or download it

### Requirement: Folder storage discloses the encryption boundary

The Storage location UI SHALL state that files sync as-is and are not encrypted by
Endstate. The UI SHALL call this a storage location and SHALL NOT describe a folder
destination as backup.

#### Scenario: User reviews sync-folder choices

- **WHEN** the Storage location card presents synced or custom folders
- **THEN** adjacent copy states that files sync as-is and are not encrypted by
  Endstate
- **AND** no folder option is labelled as backup

### Requirement: Hosted Backup remains isolated

Changing a folder destination SHALL affect only where local setup artifacts are read
and written. It SHALL NOT invoke or alter Hosted Backup versions, `--if-changed`,
claim, recover, restore, quota, subscription, or any `backup` command behavior.

#### Scenario: User changes storage destination

- **WHEN** the user selects a different folder destination
- **THEN** the GUI refreshes local profiles from that folder
- **AND** invokes no Hosted Backup command
