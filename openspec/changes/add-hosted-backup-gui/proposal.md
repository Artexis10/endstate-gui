## Why

Engine v2.0.0 ships hosted backup support: 11 `endstate backup *` subcommands plus `endstate account delete`. Substrate v2.0 is deployed at substratesystems.io and the recovery flow has been verified end-to-end against production. The GUI now needs the user-facing surfaces required by the locked Hosted Backup contract (`../endstate/docs/contracts/hosted-backup-contract.md`, v2.0, 2026-05-10):

- Sign-in / sign-up flow with mandatory recovery-key UX (contract §1)
- Backup pane (subscription banner, version list, push/pull/delete)
- Restore-on-new-machine wizard
- Forgot-passphrase recovery flow (contract §6)
- Account settings (subscription status, sign-out, account deletion per §12)
- Engine version-compatibility gate

The recovery-key UX (contract §1) is load-bearing for the trust model: a user who skips the recovery key and forgets their passphrase loses their data with no recourse. The GUI MUST require two save methods before signup completes — no escape hatch.

## What Changes

- Extend engine event types: new phases `backup-push` / `backup-pull`, new `BackupChunkEvent` with statuses `uploading | uploaded | downloading | verified | decrypted | failed`
- Extend `EndstateCapabilitiesData.features` with `hostedBackup: { supported, minSchemaVersion, issuerUrl, audience }`
- Add typed `CliBridge` wrappers for all 11 `endstate backup *` commands plus `endstate account delete`
- Pass passphrases / mnemonics via stdin (engine requirement) — extend Tauri `engine_adapter.rs` with stdin pipe support (minimal, user-authorised exception per AI_CONTRACT.md)
- New `'auth'` PageType: three-tab pane (Sign in / Sign up / Forgot passphrase)
- New recovery-key dialog: 4×6 numbered word grid, three save methods (file, PDF via `jspdf`, clipboard), 2-of-3 required before continue, no close path, no escape hatch
- New `'backup'` PageType: subscription banner (active / grace / cancelled / none), backup list, version list, push/pull/delete actions, streaming progress dialogs with cancel
- New restore-on-new-machine wizard: triggered when signed-in user has remote backups but zero local profiles
- New account section in settings: email, subscription status with Manage link, Sign out, Delete account (email-match confirmation)
- Engine compatibility gate: hide all hosted-backup UI if `capabilities.features.hostedBackup.supported !== true`
- Add `jspdf` dependency

## Capabilities

### New Capabilities

- **`auth-ui`** — Sign-in, sign-up, recovery-key generation/presentation/verification, forgot-passphrase flow
- **`backup-pane`** — Subscription state, backup list, version list, push/pull/delete actions, restore-on-new-machine wizard, streaming progress
- **`account-ui`** — Account settings section, sign-out, GDPR account deletion

### Modified Capabilities

- **`engine-bridge`** (existing) — extend with stdin support; add typed wrappers for backup/account commands; extend streaming-event types

## Impact

- **Created**: `src/components/app/auth/*`, `src/components/app/backup/*`, `src/components/app/account/*`, three OpenSpec specs under `add-hosted-backup-gui/specs/`
- **Modified**: `src/cli-bridge.ts`, `src/types.ts`, `src/lib/streaming-events.ts`, `src/App.tsx`, `src/lib/tauri-bridge.ts`, `src-tauri/src/engine_adapter.rs` (stdin only — user-authorised), `src-tauri/src/lib.rs` (new Tauri command for stdin write), `package.json` (jspdf), `README.md`
- **No engine/substrate work** — engine v2.0.0 is shipped and pinned via PR #35
- **No contract changes** — GUI consumes the v2.0 contract as-is
- **Bundle size** — adds ~80 KB (jspdf gzipped); acceptable for the recovery-key PDF feature
