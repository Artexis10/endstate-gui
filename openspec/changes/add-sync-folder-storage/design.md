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

Current profile discovery validates every candidate and reads its optional metadata.
Opening an online-only candidate can make OneDrive Files On-Demand, Google Drive
streaming, or Dropbox download it. Current profile saves also write directly to the
destination, so a sharing violation from a sync client can interrupt the operation
without a transactional commit boundary.

## Goals / Non-Goals

**Goals:**

- Make local and synced setup storage discoverable without changing setup file
  semantics.
- Persist a destination shape that can gain another `kind` later without another
  bare-string migration.
- Preserve every existing custom path.
- Support multiple accounts and isolate failures between providers.
- Avoid implicit downloads while enumerating setup files.
- Fail locked saves without replacing a complete setup with partial content.
- Keep provider-created conflict copies visible and distinct.
- Describe a redirected default Documents folder truthfully.
- State clearly that Endstate does not encrypt files in a folder destination.

**Non-goals:**

- Reimplement Hosted Backup on the client.
- Authenticate to a sync provider or determine whether its sync is healthy.
- Encrypt local files or design encryption-key custody.
- Infer remote versions, quota, or recovery behavior from a synced folder.
- Merge, delete, or choose between provider-created conflict copies.

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

`null` means the existing default Documents directory. A selected provider and a
manually entered directory both persist as `kind: 'folder'`; provider names are not
persisted.
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

Duplicate canonical paths are removed within each provider. OneDrive and Dropbox labels
use the provider's personal/business metadata. Google Drive labels use the account's
mount, the way Explorer names it: `Google Drive (G:)` for a drive letter, or the folder
name, as in `Google Drive (Work Drive)`, for an account that mirrors to a folder. A
mount-based label is what people recognize and, unlike an ordinal, does not shift when
an account is added. The UI also shows the discovered path.

A provider with no signed-in account, including Drive for desktop with an empty
account list, is `not-detected`, not an error.

### 4. Use local Windows discovery sources

- OneDrive reads all three environment variables first, then enumerates
  `HKCU\Software\Microsoft\OneDrive\Accounts` and reads `UserFolder` from account
  subkeys such as `Personal`, `Business1`, and `Business2`. Registry values supplement
  missing environment values and provide a fallback when the variables are absent.
  Equal paths are deduplicated, while distinct personal and commercial paths remain
  separate.
- Google Drive reads the single `PerAccountPreferences` string value under
  `HKCU\Software\Google\DriveFS`. It holds every account as JSON:
  `{"per_account_preferences":[{"key":"…","value":{"mount_point_path":"G"}}]}`.
  Each account's `mount_point_path` is a drive letter (`G`, mapped to `G:\My Drive`) or
  a folder (mapped to `<folder>\My Drive`), and the mount names the account (see
  section 3). Values under the key that are not strings are ignored. This data is not a
  documented public format, so a malformed payload or an account without a mount
  produces a visible provider-level reason without exposing raw registry content.
- Dropbox checks `Dropbox\info.json` under both `%LOCALAPPDATA%` and `%APPDATA%` and
  extracts `personal.path` and `business.path` from every readable file. Equal paths
  are deduplicated.

One-click selection appends `Endstate` to the discovered sync root before storing the
folder destination, matching the working `%OneDrive%\Endstate` configuration described
in issue #216.

The command is Windows-specific. Other targets return `unsupported` provider states
while retaining the default and custom-folder choices. Pure web mode uses the same
unsupported result and never inspects the test host.

Direct registry access is preferred over parsing localized `reg.exe` output. If the
existing dependency graph has no suitable API, use a target-specific Rust registry
dependency so non-Windows builds do not acquire Windows behavior.

### 5. Classify the default Documents location without changing its identity

The default option remains a null destination resolved through
`get_default_profiles_directory`. Its label is **Documents (default)**, not **This
device**, because Windows Known Folder Move can place Documents below a OneDrive root.

After provider discovery, the GUI compares the resolved default path with detected
sync roots using case-insensitive Windows path containment. If the default sits below
a OneDrive root, the option displays **Synced with OneDrive** and the same unencrypted
files disclosure as an explicit provider choice. It remains the null/default
destination; the GUI does not rewrite it to a provider path or create a duplicate
setting.

### 6. Do not hydrate online-only setups during discovery

Native listing returns each candidate's path and local availability. On Windows,
availability is determined from filesystem attributes before the file is opened.
Candidates marked offline or recall-on-access are returned as `online-only`.

`file-discovery.ts` does not call profile validation or read a metadata sidecar for an
online-only candidate. It shows a disabled placeholder derived from the filename with
an **Online-only** status and guidance to make the file available locally in the sync
app. The next explicit or normal profile refresh validates it after the sync client
makes it local. Endstate never requests hydration merely to populate the setup list.

This trades immediate metadata and app counts for predictable network and disk use.
The user remains in control of which remote setup is downloaded.

### 7. Commit profile saves transactionally

Profile saves use a native helper rather than direct `write_text_file`. The helper:

1. Writes complete content to a uniquely named sibling staging entry whose name is
   excluded from setup discovery.
2. Flushes and closes the staging file.
3. Atomically renames or replaces the final setup path.
4. On any failure, keeps an existing final setup unchanged or a new final path absent,
   reports the error, and cleans the staging entry.

For a new save with optional display metadata, metadata is staged before the profile
payload and the payload is the final commit marker. A failed payload commit removes
the staged or newly committed metadata. Rename-only metadata updates use the same
single-file transactional helper.

A sharing violation or lock on the final path or staging entry produces a clear
storage-busy error. If a sync client prevents immediate staging cleanup, the staging
name remains undiscoverable and cleanup is retried on the next directory access. It
never appears as a setup and never replaces the prior complete file.

Imports retain their existing transactional importer. This decision adds the same
partial-file safety to profile saves rather than changing import semantics.

### 8. Treat conflict copies as independent setup artifacts

Every locally available provider-created conflict copy with a supported extension and
valid contents is discovered by its distinct filesystem path. Endstate does not infer
which copy is authoritative and does not merge, delete, or overwrite either one.

If two valid copies have the same internal or display name, the UI includes their
filenames to keep both choices distinguishable. Online-only and invalid conflict
copies follow the same availability and validation rules as any other candidate.

### 9. Present storage separately from engine configuration

The Settings page gains a **Storage location** card. It contains:

- **Documents (default)**, annotated when the resolved directory is synced by
  OneDrive.
- One row per detected sync location, including multiple accounts.
- Visible unavailable rows for OneDrive, Google Drive, and Dropbox with
  install/setup guidance or a safe provider-specific parsing reason.
- **Custom folder**, retaining free-text input and adding a native **Browse** button.

Choosing a detected row updates only the destination path. Editing or browsing a
custom folder creates the same folder destination. No option uses the word "backup".

The card displays: **Files in this location sync as-is and aren't encrypted by
Endstate.** The warning is adjacent to the sync/custom choices and does not claim that
the provider itself is insecure.

### 10. Hosted Backup remains a separate system

The change does not call or modify `backup push`, `backup list`, `backup versions`,
claim, recover, restore, quota, subscription, or `--if-changed` paths. Folder
destinations only determine where local setup artifacts are read and written.

## Risks / Trade-offs

- **A settings migration could relocate existing profiles.** Preserve the legacy path
  byte-for-byte and cover both empty and non-empty migration cases.
- **Provider metadata can be malformed or partially configured.** Return per-provider
  status with a safe visible reason, and test parsers with injected environment,
  registry, and file inputs.
- **Multiple variables can identify the same OneDrive folder.** Deduplicate paths
  case-insensitively on Windows while retaining distinct roots.
- **Discovery could hydrate every remote setup.** Inspect filesystem availability
  before opening content and render online-only placeholders without validation.
- **A sync client can lock the final or staging file.** Use an undiscoverable staging
  entry and atomic commit; preserve the prior complete destination and retry orphan
  staging cleanup later.
- **Conflict copies can share a display name.** Keep them as separate path identities
  and include filenames when labels would otherwise collide.
- **Known Folder Move makes the default a sync location.** Label the default by its
  Documents identity and annotate detected OneDrive containment instead of claiming
  it is device-only.
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
4. Add provider discovery, file-availability, and transactional-save tests.
5. Update profile discovery to preserve online-only and conflict-copy entries.
6. Add the Storage location component and integrate it into Settings.
7. Update the legacy illustrative state spec and persistence fixtures.
8. Roll back by reverting the change; migrated destinations retain the original path
   and can be mechanically represented by the legacy string if required.

## Open Questions

None. Review of this proposal is the approval point for the field name, destination
shape, `<sync root>\Endstate` convention, target-specific registry dependency,
online-only behavior, and transactional save boundary.
