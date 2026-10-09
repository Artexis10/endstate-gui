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
- [ ] 2.2 Read all OneDrive environment variants and deduplicate equal Windows paths.
- [ ] 2.3 Read every Google Drive account registry payload and resolve each `My Drive`
  root.
- [ ] 2.4 Parse Dropbox personal and business paths from `info.json`.
- [ ] 2.5 Return provider-level detected, not-detected, error, and unsupported states
  without allowing one provider failure to erase another provider's results.
- [ ] 2.6 Add Rust tests with injected environment, registry, and file data so tests
  do not depend on the developer machine.

## 3. Bridge And Directory Resolution

- [ ] 3.1 Register the native discovery command and expose typed frontend invocation.
- [ ] 3.2 Add a deterministic non-native fallback that performs no host inspection.
- [ ] 3.3 Resolve the profiles directory from `StorageDestination | null` at every
  existing read/write boundary.

## 4. Storage Location UI

- [ ] 4.1 Add a dedicated shadcn-based Storage location component outside Engine
  Configuration.
- [ ] 4.2 Render the default local destination, all detected accounts, and visible
  install/setup guidance for undetected providers.
- [ ] 4.3 Store one-click provider choices as `<sync root>\Endstate`.
- [ ] 4.4 Keep free-text entry and add a native folder Browse action.
- [ ] 4.5 Display the unencrypted sync warning and avoid backup terminology.
- [ ] 4.6 Add component tests for selection, multiple accounts, unavailable/error
  states, browsing, free text, and warning copy.

## 5. Compatibility And Verification

- [ ] 5.1 Update affected `AppSettings` fixtures and the legacy
  `draft-and-profile-state.md` model.
- [ ] 5.2 Add or update the persistence reload test for a typed destination.
- [ ] 5.3 Confirm no Hosted Backup command or component changed.
- [ ] 5.4 Run focused TypeScript settings/component tests and Rust discovery tests.
- [ ] 5.5 Run TypeScript build, lint, strict OpenSpec validation, and only the
  persistence E2E scenario needed for this change.
- [ ] 5.6 Inspect the final diff for version changes, unrelated refactors, generated
  artifacts, and unintended dependency churn.
