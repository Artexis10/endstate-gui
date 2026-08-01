## Context

`AppSettings.customProfilesDirectory` is currently a string. `App.tsx` passes it to
`getProfilesDirectory`, which returns the string unchanged or invokes
`get_default_profiles_directory` when it is empty. The same value triggers profile
rediscovery and is edited through a free-text input inside the Engine Configuration
card.

The requested providers expose local folders through Windows environment variables,
the current-user registry, or a local JSON file. Browser JavaScript cannot access
those sources, so discovery needs a narrow native boundary. The folder picker can use
the already-installed Tauri dialog plugin.

## Goals / Non-Goals

**Goals:**

- Make local and synced setup storage discoverable without changing setup file
  semantics.
- Persist a destination shape that can gain another `kind` later without another
  bare-string migration.
- Preserve every existing custom path.
- Support multiple accounts and isolate failures between providers.
- State clearly that Endstate does not encrypt files in a folder destination.

**Non-goals:**

- Reimplement Hosted Backup on the client.
- Authenticate to a sync provider or determine whether its sync is healthy.
- Encrypt local files or design encryption-key custody.
- Infer remote versions, quota, conflicts, or recovery behavior from a synced folder.

## Decisions

### 1. Persist a discriminated destination

The settings model becomes:

```ts
export type StorageDestination = {
  kind: 'folder';
  path: string;
};

export interface AppSettings {
  storageDestination: StorageDestination | null;
  // existing fields...
}
```

`null` means the existing default local directory. A selected provider and a manually
entered directory both persist as `kind: 'folder'`; provider names are not persisted.
This keeps execution dependent only on the chosen path and leaves room for a future
direct-upload variant.

On settings load:

1. A valid `storageDestination` wins.
2. Otherwise, a non-empty legacy `customProfilesDirectory` becomes a folder
   destination with the same path.
3. An empty or absent legacy value becomes `null`.
4. The legacy key is removed from the normalized settings written back to storage.

The migration changes representation only. It does not normalize, expand, relocate,
or create the legacy path.

### 2. Resolve all setup storage through one helper

A pure helper resolves `StorageDestination | null` to either its folder path or the
existing native default. `App.tsx` uses that helper everywhere it currently reads
`customProfilesDirectory`, so save, import, discovery, rename, delete, and setup
continue to share one active directory.

The selected folder is created only at an existing write/import boundary through
`ensureDirectory`. Merely discovering or displaying a provider does not write to it.

### 3. Keep discovery metadata transient

The native command returns provider-level results:

```ts
type SyncProvider = 'onedrive' | 'google-drive' | 'dropbox';

interface SyncFolderLocation {
  id: string;
  provider: SyncProvider;
  label: string;
  path: string;
}

interface SyncProviderDiscovery {
  provider: SyncProvider;
  status: 'detected' | 'not-detected' | 'error' | 'unsupported';
  locations: SyncFolderLocation[];
  message?: string;
}
```

Each provider is probed independently. Malformed Dropbox JSON or an unreadable Google
Drive registry key produces an error for that provider without discarding OneDrive or
other successful results. Missing expected data is `not-detected`, not an error.

Duplicate canonical paths are removed within each provider. Account labels prefer the
provider's personal/business metadata; otherwise they use a stable ordinal such as
`Google Drive account 2`. The UI may display the discovered path so same-type accounts
remain distinguishable.

### 4. Use the documented Windows discovery sources

- OneDrive reads all three documented environment variables. Equal paths are
  deduplicated, while distinct personal and commercial paths remain separate.
- Google Drive reads every value under
  `HKCU\Software\Google\DriveFS\PerAccountPreferences`, parses each JSON payload, and
  appends `My Drive` to `mount_point_path`.
- Dropbox reads `%LOCALAPPDATA%\Dropbox\info.json` and extracts both `personal.path`
  and `business.path` when present.

One-click selection appends `Endstate` to the discovered sync root before storing the
folder destination, matching the working `%OneDrive%\Endstate` configuration described
in issue #216.

The command is Windows-specific. Other targets return `unsupported` provider states
while retaining the default and custom-folder choices. Pure web mode uses the same
unsupported result and never inspects the test host.

Direct registry access is preferred over parsing localized `reg.exe` output. If the
existing dependency graph has no suitable API, use a target-specific Rust registry
dependency so non-Windows builds do not acquire Windows behavior.

### 5. Present storage separately from engine configuration

The Settings page gains a **Storage location** card. It contains:

- **This device**, representing the existing default directory.
- One row per detected sync location, including multiple accounts.
- Visible unavailable rows for OneDrive, Google Drive, and Dropbox with
  install/setup guidance.
- **Custom folder**, retaining free-text input and adding a native **Browse** button.

Choosing a detected row updates only the destination path. Editing or browsing a
custom folder creates the same folder destination. No option uses the word "backup".

The card displays: **Files in this location sync as-is and aren't encrypted by
Endstate.** The warning is adjacent to the sync/custom choices and does not claim that
the provider itself is insecure.

### 6. Hosted Backup remains a separate system

The change does not call or modify `backup push`, `backup list`, `backup versions`,
claim, recover, restore, quota, subscription, or `--if-changed` paths. Folder
destinations only determine where local setup artifacts are read and written.

## Risks / Trade-offs

- **A settings migration could relocate existing profiles.** Preserve the legacy path
  byte-for-byte and cover both empty and non-empty migration cases.
- **Provider metadata can be malformed or partially configured.** Return per-provider
  status and test parsers with injected environment, registry, and file inputs.
- **Multiple variables can identify the same OneDrive folder.** Deduplicate paths
  case-insensitively on Windows while retaining distinct roots.
- **A synced folder may be unavailable after selection.** Keep the saved path visible
  and let existing filesystem errors surface; do not silently fall back to the local
  default.
- **Provider labels can expose an account identity.** Prefer generic account labels
  unless the local metadata already supplies a personal/business designation needed
  to distinguish choices.
- **Adding a registry crate changes the Rust lockfile.** Keep it Windows-targeted and
  avoid any frontend dependency change.

## Migration Plan

1. Add migration tests before changing the settings type.
2. Normalize stored settings to `storageDestination` and remove the legacy key.
3. Route directory resolution through the typed destination.
4. Add native discovery and parser tests.
5. Add the Storage location component and integrate it into Settings.
6. Update the legacy illustrative state spec and persistence fixtures.
7. Roll back by reverting the change; migrated destinations retain the original path
   and can be mechanically represented by the legacy string if required.

## Open Questions

None. Review of this proposal is the approval point for the field name, destination
shape, `<sync root>\Endstate` convention, and target-specific registry dependency.
