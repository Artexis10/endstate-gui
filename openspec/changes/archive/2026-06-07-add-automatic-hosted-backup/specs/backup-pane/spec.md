## MODIFIED Requirements

### Requirement: Last sync indicator

The backup pane SHALL render a relative-time indicator below the quota meter using
`status.lastBackupAt`. The label and freshness band SHALL be produced by the
`formatRelativeTime` utility. When `lastBackupAt` is absent or unparseable, the indicator
SHALL render "No backups yet" in the calm muted-foreground tint. The indicator SHALL NOT be
a live region. When automatic backup is paused because a background push returned
`AUTH_REQUIRED`, the indicator SHALL render a persistent, actionable "Sign in to resume
backups" affordance in the warning tint, replacing the freshness label until the session is
restored.

#### Scenario: Recently synced renders fresh tint
- **GIVEN** `lastBackupAt` was within the last 24 hours
- **WHEN** the backup pane renders
- **THEN** the indicator shows a relative-time label in `text-muted-foreground`
- **AND** `data-freshness="fresh"`

#### Scenario: Stale (1–7 days) renders warning tint
- **GIVEN** `lastBackupAt` was 25 hours to 7 days ago
- **WHEN** the backup pane renders
- **THEN** the indicator shows a "N days ago" label in `text-warning/80`
- **AND** `data-freshness="stale"`

#### Scenario: Very-stale renders locale short date
- **GIVEN** `lastBackupAt` was >=7 days ago
- **WHEN** the backup pane renders
- **THEN** the indicator shows a locale-formatted short date in `text-danger/80`
- **AND** `data-freshness="very-stale"`

#### Scenario: Missing lastBackupAt renders "No backups yet"
- **GIVEN** `lastBackupAt` is undefined or unparseable
- **WHEN** the backup pane renders
- **THEN** the indicator shows "No backups yet" in `text-muted-foreground`
- **AND** `data-freshness="never"`

#### Scenario: Auto-backup paused renders "Sign in to resume backups"
- **GIVEN** automatic backup is enabled and a background auto-push returned `AUTH_REQUIRED`
- **WHEN** the backup pane renders the last-sync indicator
- **THEN** it shows an actionable "Sign in to resume backups" affordance in the warning tint
- **AND** clicking it opens the inline re-auth dialog (per "Session re-auth preserves pane state")
- **AND** the affordance persists across renders until the session is restored
