## Why
Wave 1 landed the Account Portal handoff; three remaining UX gaps in the same pane remain. The focus-triggered refresh blanks the pane to a spinner on every Alt-Tab. The 90% quota signal is a single one-shot toast — dismiss it and the user has no persistent surface telling them storage is filling up. And the pane shows backups with no indication of how recent the cloud state actually is. All pure GUI; every required field is already in `BackupStatusData`.

## What changes
- **Silent SWR refresh.** `useBackupState`'s `refresh` accepts `{ silent?: boolean }`. Focus-triggered refresh passes `silent: true`; the pane is not blanked, cached data stays visible, non-AUTH errors are swallowed. AUTH_REQUIRED continues to route through `onAuthLost` unless a re-auth dialog is already open. A monotonic run-id guards both silent and loud paths against state-clobber races.
- **Quota-near-limit banner.** New `QuotaNotice` component renders a warn-tone banner at ≥50% and danger-tone banner at ≥90% above QuotaMeter. Replaces the existing once-per-account toast (retired).
- **Last-sync indicator.** New `LastSyncIndicator` component renders a single muted-text row below QuotaMeter, backed by a new `formatRelativeTime` lib utility with freshness bands.
- **Shared `quotaTone` util.** New `src/lib/quota-tone.ts` is the single source of truth for the 50%/90% bands; QuotaMeter refactored to consume it (no behavior change).

## Impact
- Affected specs: `backup-pane` — ADD requirements `Silent focus refresh`, `Quota approaching cap notice`, `Last sync indicator`. The existing `Session re-auth preserves pane state` requirement is NOT modified — the silent-refresh requirement covers the AUTH dedupe in its own scenario.
- Affected code: see "Critical files" above.
- Dependencies: none. No engine bump, no substrate change.
