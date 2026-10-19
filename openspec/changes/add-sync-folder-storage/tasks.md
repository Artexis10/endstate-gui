## 1. Settings Contract And Migration

- [ ] 1.1 Add `StorageDestination` and replace `customProfilesDirectory` in
  `AppSettings`.
- [ ] 1.2 Migrate empty and non-empty legacy settings without changing paths, and
  remove the legacy key from normalized persistence.
- [ ] 1.3 Add focused settings and persistence tests for defaults, migration,
  round-trip behavior, and invalid stored data.

## 2. Native Sync-Folder Discovery

- [ ] 2.1 Add typed provider discovery models and independent OneDrive, Google Drive,
  and Dropbox probes.
- [ ] 2.2 Read all OneDrive environment variants, enumerate account `UserFolder`
  registry fallbacks, and deduplicate equal Windows paths.
- [ ] 2.3 Read every Google Drive account registry payload and resolve each `My Drive`
  root.
- [ ] 2.4 Parse Dropbox personal and business paths from `%LOCALAPPDATA%` and
  `%APPDATA%` `info.json` files.
- [ ] 2.5 Return provider-level detected, not-detected, error, and unsupported states
  with safe visible reasons, without allowing one provider failure to erase another
  provider's results.
- [ ] 2.6 Add Rust tests with injected environment, registry, and file data so tests
  do not depend on the developer machine.

## 3. Safe Synced-Folder I/O

- [ ] 3.1 Return local versus online-only availability without opening candidate
  setup content.
- [ ] 3.2 Keep online-only files visible but disabled, skip validation and metadata
  reads, and refresh them normally once local.
- [ ] 3.3 Add a transactional profile-save command with undiscoverable staging,
  atomic commit, visible sharing-violation errors, rollback, and deferred staging
  cleanup.
- [ ] 3.4 Discover provider-created conflict copies as separate path identities and
  disambiguate duplicate labels with filenames.
- [ ] 3.5 Add focused tests for no-hydration discovery, locks on final and staging
  files, rollback/cleanup, and conflict copies.

## 4. Bridge And Directory Resolution

- [ ] 4.1 Register the native discovery, availability, and transactional-save
  commands and expose typed frontend invocation.
- [ ] 4.2 Add deterministic non-native fallbacks that perform no host inspection.
- [ ] 4.3 Resolve the profiles directory from `StorageDestination | null` at every
  existing read/write boundary.

## 5. Storage Location UI

- [ ] 5.1 Add a dedicated shadcn-based Storage location component outside Engine
  Configuration.
- [ ] 5.2 Render **Documents (default)**, annotate OneDrive Known Folder Move, render
  all detected accounts, and keep unavailable/error providers visible with guidance.
- [ ] 5.3 Store one-click provider choices as `<sync root>\Endstate`.
- [ ] 5.4 Keep free-text entry and add a native folder Browse action.
- [ ] 5.5 Display the unencrypted sync warning and avoid backup terminology.
- [ ] 5.6 Add component tests for selection, multiple accounts, Known Folder Move,
  unavailable/error states, browsing, free text, and warning copy.

## 6. Compatibility And Verification

- [ ] 6.1 Update affected `AppSettings` fixtures and the legacy
  `draft-and-profile-state.md` model.
- [ ] 6.2 Add or update the persistence reload test for a typed destination.
- [ ] 6.3 Confirm no Hosted Backup command or component changed.
- [ ] 6.4 Run focused TypeScript settings/component tests and Rust discovery/I/O
  tests.
- [ ] 6.5 Run TypeScript build, lint, strict OpenSpec validation, and only the
  persistence E2E scenario needed for this change.
- [ ] 6.6 Inspect the final diff for version changes, unrelated refactors, generated
  artifacts, and unintended dependency churn.
