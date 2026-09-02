# Proposal: add-sync-folder-storage

## Why

Endstate already lets users store setups in a synced folder through the free-text
`Custom Storage Directory` setting, but that control is buried inside Engine
Configuration and does not explain what syncing means. Users can enter a OneDrive,
Google Drive, Dropbox, Proton Drive, Nextcloud, or mounted-share path today, but the
common choices are not discoverable and the persisted value is only a bare string.

Issue [#216](https://github.com/Artexis10/endstate-gui/issues/216) defines a local
sync-folder approach instead of provider APIs. The GUI should make those folders easy
to choose without introducing OAuth, remote upload logic, or an implication that local
files receive the encryption and versioning guarantees of Hosted Backup.

## What Changes

- Replace the persisted `customProfilesDirectory` string with a typed
  `storageDestination` value:

  ```ts
  type StorageDestination = {
    kind: 'folder';
    path: string;
  };
  ```

  A `null` destination continues to mean the default
  `Documents\Endstate\Setups` folder. Existing non-empty
  `customProfilesDirectory` values migrate to `{ kind: 'folder', path }` without
  changing where setups are stored.
- Move setup storage out of Engine Configuration into a dedicated **Storage
  location** card. Keep direct path entry, add a native folder picker, and offer the
  default local folder plus detected sync folders as one-click choices.
- Detect Windows sync folders locally, with no authentication:
  - OneDrive from `OneDrive`, `OneDriveConsumer`, and `OneDriveCommercial`
    environment variables, including simultaneous personal and work locations.
  - Google Drive accounts from
    `HKCU\Software\Google\DriveFS\PerAccountPreferences`, using each account's
    `mount_point_path` and its `My Drive` root.
  - Dropbox personal and business locations from
    `%LOCALAPPDATA%\Dropbox\info.json`.
- Keep OneDrive, Google Drive, and Dropbox visible when no folder is detected, with
  guidance to install or set up the desktop app. A provider failure must not hide
  successfully detected locations from another provider.
- Store a provider selection as a normal folder destination under
  `<sync root>\Endstate`. Provider identity and account labels are discovery metadata,
  not part of the persisted destination schema.
- Show clear adjacent copy that files in these locations sync as-is and are not
  encrypted by Endstate. Call the feature a storage location, not a backup.
- Keep Hosted Backup behavior isolated. Versions, `--if-changed`, claim, recover,
  restore, quota, and every `backup` command remain unchanged.

## Capabilities

### New Capabilities

- `storage-destinations`: typed setup-storage destinations, backward-compatible
  settings migration, local sync-folder discovery, folder browsing, and clear
  encryption disclosure.

### Modified Capabilities

<!-- None. The legacy draft-and-profile-state document contains an illustrative
AppSettings shape and will be updated during implementation, but its profile-selection
and draft invariants do not change. -->

## Impact

- `src/settings.ts`: introduce `StorageDestination`, migrate
  `customProfilesDirectory`, and stop persisting the legacy field.
- `src/lib/tauri-bridge.ts`: expose typed sync-folder discovery with a deterministic
  web fallback.
- `src/components/app/settings/storage-location-setting.tsx` (new): render local,
  detected, unavailable, browse, free-text, and encryption-warning states.
- `src/App.tsx`: resolve the active profiles directory from the destination and place
  the new settings card outside Engine Configuration.
- `src-tauri/src/sync_folders.rs` (new) and `src-tauri/src/lib.rs`: perform native
  Windows discovery and register the Tauri command.
- `src-tauri/Cargo.toml` and `Cargo.lock`: add a Windows-targeted registry reader if
  direct registry access cannot be implemented with an existing dependency.
- Focused TypeScript and Rust tests, plus the existing settings persistence fixture
  that covers reload behavior.
- `openspec/specs/draft-and-profile-state.md`: replace the obsolete illustrative
  `customProfilesDirectory` field with the typed destination.

## Non-goals

- Calling OneDrive, Google Drive, Dropbox, or any other provider API.
- Adding OAuth, provider credentials, upload state, quota tracking, remote versions,
  conflict resolution, or sync-health monitoring.
- Encrypting local setup files. Encryption and key custody are tracked separately in
  [Artexis10/endstate#211](https://github.com/Artexis10/endstate/issues/211).
- Changing the Hosted Backup pane or any engine `backup` command.
- Detecting macOS or Linux sync clients in this change. Folder browsing and custom
  paths remain available on those platforms.
