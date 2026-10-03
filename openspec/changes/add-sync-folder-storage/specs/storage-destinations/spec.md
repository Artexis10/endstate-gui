# Storage Destinations

Setup artifacts may be stored in the default local folder, a discovered local sync
folder, or any user-entered folder. Folder storage remains distinct from Hosted Backup.

## ADDED Requirements

### Requirement: Storage destinations use a typed persisted shape

The GUI SHALL persist a selected folder as
`{ kind: "folder", path: "<selected path>" }`. The GUI SHALL represent the existing
default `Documents\Endstate\Setups` location as a null destination. Runtime profile
directory resolution SHALL use the typed destination consistently for discovery,
save, import, rename, delete, and setup.

#### Scenario: Default local storage

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
- **AND** the GUI does not silently fall back to the default local folder

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
local location, every detected sync-folder account, and a custom folder option. The
custom option SHALL support both free-text entry and a native folder picker.

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

#### Scenario: Multiple Google Drive accounts

- **GIVEN** the Google Drive per-account registry data contains two valid
  `mount_point_path` values
- **WHEN** discovery runs
- **THEN** both `<mount point>\My Drive` roots are returned

#### Scenario: Personal and business Dropbox coexist

- **GIVEN** Dropbox `info.json` contains both `personal.path` and `business.path`
- **WHEN** discovery runs
- **THEN** both folders are returned as separate choices

#### Scenario: Provider data is malformed

- **GIVEN** one provider's local metadata cannot be parsed
- **WHEN** discovery runs
- **THEN** that provider reports an error state
- **AND** valid folders from other providers remain available

#### Scenario: Non-Windows runtime

- **GIVEN** the GUI runs outside the Windows desktop runtime
- **WHEN** sync-folder discovery is requested
- **THEN** provider discovery reports unsupported
- **AND** default and custom folder choices remain available

### Requirement: Provider choices remain visible when not detected

The Storage location card SHALL keep OneDrive, Google Drive, and Dropbox visible when
no corresponding folder is detected. Each unavailable provider SHALL state that it
was not detected and direct the user to install or set up its desktop app rather than
silently hiding the choice.

#### Scenario: Google Drive desktop app is absent

- **GIVEN** no Google Drive account folder is detected
- **WHEN** the Storage location card renders
- **THEN** Google Drive remains visible as not detected
- **AND** the UI gives desktop-app install or setup guidance

### Requirement: One-click provider choices use an Endstate subfolder

Selecting a discovered provider root SHALL persist a folder destination at
`<sync root>\Endstate`. Discovery alone SHALL NOT create the directory. Existing write
and import boundaries SHALL create it when needed.

#### Scenario: OneDrive selected

- **GIVEN** OneDrive is detected at `C:\Users\me\OneDrive`
- **WHEN** the user selects it
- **THEN** the persisted folder destination path is
  `C:\Users\me\OneDrive\Endstate`

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
