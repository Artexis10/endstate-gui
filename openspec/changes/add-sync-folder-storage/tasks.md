## 1. Settings Contract And Migration

- [x] 1.1 Add `StorageDestination` and replace `customProfilesDirectory` in
  `AppSettings`.
- [x] 1.2 Migrate empty and non-empty legacy settings without changing paths, and
  remove the legacy key from normalized persistence.
- [x] 1.3 Add focused settings and persistence tests for defaults, migration,
  round-trip behavior, and invalid stored data.

## 2. Native Sync-Folder Discovery

- [x] 2.1 Add typed provider discovery models and independent OneDrive, Google Drive,
  and Dropbox probes.
- [x] 2.2 Read all OneDrive environment variants, enumerate account `UserFolder`
  registry fallbacks, and deduplicate equal Windows paths.
- [x] 2.3 Read every Google Drive account registry payload and resolve each `My Drive`
  root.
- [x] 2.4 Parse Dropbox personal and business paths from `%LOCALAPPDATA%` and
  `%APPDATA%` `info.json` files.
- [x] 2.5 Return provider-level detected, not-detected, error, and unsupported states
  with safe visible reasons, without allowing one provider failure to erase another
  provider's results.
- [x] 2.6 Add Rust tests with injected environment, registry, and file data so tests
  do not depend on the developer machine.

## 3. Safe Synced-Folder I/O

- [x] 3.1 Return local versus online-only availability without opening candidate
  setup content.
- [x] 3.2 Keep online-only files visible but disabled, skip validation and metadata
  reads, and refresh them normally once local.
- [x] 3.3 Add a transactional profile-save command with undiscoverable staging,
  atomic commit, visible sharing-violation errors, rollback, and deferred staging
  cleanup.
- [x] 3.4 Discover provider-created conflict copies as separate path identities and
  disambiguate duplicate labels with filenames.
- [x] 3.5 Add focused tests for no-hydration discovery, locks on final and staging
  files, rollback/cleanup, and conflict copies.

## 4. Bridge And Directory Resolution

- [x] 4.1 Register the native discovery, availability, and transactional-save
  commands and expose typed frontend invocation.
- [x] 4.2 Add deterministic non-native fallbacks that perform no host inspection.
- [x] 4.3 Resolve the profiles directory from `StorageDestination | null` at every
  existing read/write boundary.

## 5. Storage Location UI

- [x] 5.1 Add a dedicated shadcn-based Storage location component outside Engine
  Configuration.
- [x] 5.2 Render **Documents (default)**, annotate OneDrive Known Folder Move, render
  all detected accounts, and keep unavailable/error providers visible with guidance.
- [x] 5.3 Store one-click provider choices as `<sync root>\Endstate`.
- [x] 5.4 Keep free-text entry and add a native folder Browse action.
- [x] 5.5 Display the unencrypted sync warning and avoid backup terminology.
- [x] 5.6 Add component tests for selection, multiple accounts, Known Folder Move,
  unavailable/error states, browsing, free text, and warning copy.

## 6. Compatibility And Verification

- [x] 6.1 Update affected `AppSettings` fixtures and the legacy
  `draft-and-profile-state.md` model.
- [x] 6.2 Add or update the persistence reload test for a typed destination.
- [x] 6.3 Verify storage selection does not invoke or alter Hosted Backup commands.
- [x] 6.4 Run focused TypeScript settings/component tests and Rust discovery/I/O
  tests.
- [x] 6.5 Run TypeScript build, lint, strict OpenSpec validation, and only the
  persistence E2E scenario needed for this change.
- [x] 6.6 Inspect the final diff for version changes, unrelated refactors, generated
  artifacts, and unintended dependency churn.

## Implementation evidence (2026-10-19)

Implements the approved proposal in Artexis10/endstate-gui#221. The review's two
implementation notes are included: OFFLINE, RECALL_ON_OPEN, and
RECALL_ON_DATA_ACCESS are checked from cached Windows directory-enumeration data,
without per-file opens or stat calls. Staging, writes/copies, flush, rollback,
and atomic commit are owned by `engine-core/src/storage.rs`.

Validation: 272 focused frontend tests (18 files), nine native storage tests,
29 native import/validation regressions, one bridge router regression, and four
focused browser scenarios passed. This includes focused settings/migration, discovery, storage UI, save, and
import regression tests; native Windows attribute, locked-final/staging,
rollback, cleanup, binary-copy, and collision tests; and the typed-destination
persistence E2E scenario. The E2E scenario was run headlessly with installed
Edge because this checkout does not have Playwright's Chromium binary. The
Storage location screenshot was visually inspected.

TypeScript checking, Vite production compilation, ESLint, strict OpenSpec
validation, and Rust formatting pass. The native facade compiles with temporary
`TAURI_CONFIG` excluding packaging resources: the checkout lacks the engine
sidecar. No installer or runnable application was built, installed, or launched.
Provider parsers are tested with injected fixtures; no live cloud account or
actual sync client is required by these tests. Versions are unchanged.

## CI follow-up: focus-refresh timer (2026-10-19)

The coverage job exposed an existing focus-refresh race in the backup state hook:
changing the refresh callback during a render removed the focus listener and
canceled its pending debounce. A deterministic regression reproduced the same
missing second status call before the fix. The focus subscription now stays
mounted and invokes the latest refresh callback through a ref, preserving current
settings and retaining unmount cleanup. Added coverage also checks that a pending
refresh is canceled when the hook unmounts. This restores existing refresh
behavior; folder/provider selection still does not invoke any backup command.
