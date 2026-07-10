# Design: Continuous Protection UI

## Context

Engine ≥ 2.22 (main) provides `endstate schedule enable|disable|status|run` backed by Windows Task Scheduler, with state at `state/schedule/config.json` + `last-run.json`. Capabilities advertise `features.schedule { supported, autoPush }`. Per the CLI-source-of-truth invariant, the GUI must render engine-owned status and never compute drift itself.

## Decisions

### Dark-by-default capability gate

Every surface (Settings card, launch wiring, drift chip) hangs off `engineSupportsSchedule(caps)`, which defaults FALSE when `features.schedule` is absent. The bundled 2.21 engine therefore shows nothing. This mirrors `engineSupportsIfChanged` / hosted-backup gating.

### Toggle is the consent

Turning on "Check this computer for drift daily" immediately calls `schedule enable` — registering a scheduled task is reversible and transparent (`schedule status`), so no extra confirmation dialog (matches the auto-backup consent-lightweight precedent).

### Baseline manifest = the capture the user saved to file

`schedule enable` bakes a manifest path into the task; scheduled runs verify against it while the app is closed. The transient capture cache (`%LOCALAPPDATA%\Endstate\cache\captures`) is wiped on app start (`cleanup_capture_cache`), so the freshly-captured artifact path is NOT durable. The GUI therefore records the path chosen in "Save to file" (`settings.scheduleManifestPath`) as the baseline, and re-points an enabled schedule when a new capture is saved. Until a capture has been saved, the toggle is disabled with the hint "Save this computer first".

### Launch self-heal via idempotent enable

`schedule enable` is idempotent (`schtasks /F`) and re-asserts the current exe path. On boot, when the engine supports schedule and `settings.scheduleEnabled` is true, the GUI re-asserts enable (manifest preference: engine config's manifest, then `scheduleManifestPath`). Failures are logged, never block boot.

### Drift chip mapping is pure and engine-driven

`driftStateFromStatus(status)` maps `schedule status` to `never-run | clean | drift | failing`. Disabled schedules map to `never-run` even when a stale `lastRun` is retained (no future runs → stale signal). `drift` uses `verify.summary.fail`. Chip precedence on the Save card: drift (amber) > failing (muted) > "Scan complete" (session) > nothing; never-run/clean render nothing.

### Auto-push sub-toggle gating

Shown only when `features.schedule.autoPush` AND the existing `autoBackupAvailable` conditions hold (hosted backup supported, `--if-changed` advertised, signed in, active subscription). The flag is passed to `schedule enable --auto-push`; outcomes (`pushed`/`auth_required`/`error`) surface only via engine status, never interactive prompts.

## Alternatives considered

- Polling `schedule status` while the app runs: rejected — launch-time fetch is enough for a daily cadence; a manual refresh can come later.
- Using the transient capture output path as the baseline (what the in-session auto-backup uses): rejected — the cache wipe at app start would break the scheduled task with `MANIFEST_NOT_FOUND` the day after.
