## ADDED Requirements

### Requirement: Silent focus refresh
The backup pane SHALL revalidate `backup status` and `backup list` on window-focus / visibilitychange WITHOUT blanking the pane. Cached `status`, `backups`, and any prior `error` SHALL remain visible during the round-trip. On non-AUTH error the cached data SHALL remain unchanged and no error SHALL be surfaced. AUTH_REQUIRED SHALL route through `onAuthLost` only when the re-auth dialog is not already open; if the dialog is open, the silent refresh SHALL drop the event.

#### Scenario: Focus refresh leaves pane painted
- GIVEN cached status+list rendered
- WHEN window-focus fires and the debounce elapses
- THEN no loading spinner is shown at any point
- AND the cached data remains visible until the refresh resolves

#### Scenario: Focus refresh non-AUTH failure is silent
- GIVEN cached data is rendered
- WHEN the silent refresh's `backup status` rejects with BACKEND_UNREACHABLE
- THEN no toast, no inline error, cached data unchanged

#### Scenario: Focus refresh AUTH_REQUIRED routes to re-auth when dialog closed
- GIVEN cached data is rendered and the re-auth dialog is NOT open
- WHEN the silent refresh's `backup status` rejects with AUTH_REQUIRED
- THEN `onAuthLost` is invoked
- AND the cached backup list, status banner, and quota meter remain visible behind the dialog

#### Scenario: Focus refresh AUTH_REQUIRED is dropped when dialog already open
- GIVEN the re-auth dialog is already open from a prior auth loss
- WHEN a focus event triggers a silent refresh that also returns AUTH_REQUIRED
- THEN `onAuthLost` is NOT invoked again
- AND no additional dialog stacking occurs

### Requirement: Quota approaching cap notice
The backup pane SHALL render a persistent warn-tone notice above the quota meter when storage usage is `>=50%` and `<90%`, and a persistent danger-tone notice when usage is `>=90%`. The notice SHALL include the percentage and the byte-formatted used+total values. It SHALL be hidden when `quotaTotalBytes` is unset. The threshold logic SHALL match the QuotaMeter via the shared `quotaTone` utility.

#### Scenario: Warn notice between 50% and 90%
- GIVEN `quotaUsedBytes / quotaTotalBytes` is in `[0.5, 0.9)`
- WHEN the backup pane renders
- THEN a notice with `data-tone="warn"` appears above the QuotaMeter
- AND the copy includes the rounded percent and byte-formatted used/total

#### Scenario: Danger notice at or above 90%
- GIVEN ratio `>= 0.9`
- WHEN the backup pane renders
- THEN a notice with `data-tone="danger"` appears
- AND the copy includes the percent and a free-space-or-upgrade remediation

#### Scenario: Notice hidden when quota fields absent
- GIVEN `quotaTotalBytes` is unset (older engines)
- WHEN the backup pane renders
- THEN no quota notice is rendered

#### Scenario: Notice is the sole quota signal at 90%
- GIVEN ratio crosses to >=0.9
- THEN no toast fires (the previous once-per-account toast has been retired)
- AND only the persistent danger banner surfaces the signal

### Requirement: Last sync indicator
The backup pane SHALL render a relative-time indicator below the quota meter using `status.lastBackupAt`. The label and freshness band SHALL be produced by the `formatRelativeTime` utility. When `lastBackupAt` is absent or unparseable, the indicator SHALL render "No backups yet" in the calm muted-foreground tint. The indicator SHALL NOT be a live region.

#### Scenario: Recently synced renders fresh tint
- GIVEN `lastBackupAt` was within the last 24 hours
- WHEN the backup pane renders
- THEN the indicator shows a relative-time label in `text-muted-foreground`
- AND `data-freshness="fresh"`

#### Scenario: Stale (1–7 days) renders warning tint
- GIVEN `lastBackupAt` was 25 hours to 7 days ago
- WHEN the backup pane renders
- THEN the indicator shows a "N days ago" label in `text-warning/80`
- AND `data-freshness="stale"`

#### Scenario: Very-stale renders locale short date
- GIVEN `lastBackupAt` was >=7 days ago
- WHEN the backup pane renders
- THEN the indicator shows a locale-formatted short date in `text-danger/80`
- AND `data-freshness="very-stale"`

#### Scenario: Missing lastBackupAt renders "No backups yet"
- GIVEN `lastBackupAt` is undefined or unparseable
- WHEN the backup pane renders
- THEN the indicator shows "No backups yet" in `text-muted-foreground`
- AND `data-freshness="never"`
