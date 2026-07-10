## Tasks

### Task 1: Types
**File**: `src/types.ts`
- [x] `features.schedule?: { supported: boolean; autoPush: boolean }` on `EndstateCapabilitiesData`
- [x] `ScheduleStatusData` (enabled, manifest, interval, time, autoPush, taskName, lastRun) matching `schedule status --json`
- [x] Nested last-run types: `ScheduleLastRun` (runId, timestampUtc, verify, autoBackup, error), `ScheduleLastRunVerify` (summary + drifted[]), `ScheduleDriftItem`, `ScheduleLastRunBackup`, `ScheduleLastRunError`
- [x] `ScheduleEnableData` / `ScheduleDisableData`

### Task 2: Schedule bridge
**File**: `src/lib/schedule-bridge.ts`
- [x] `scheduleEnable(settings, { manifest, time?, interval?, autoPush? })` → `schedule enable --manifest … [--interval …] [--time …] [--auto-push]`
- [x] `scheduleDisable(settings)` / `scheduleStatus(settings)`
- [x] `ScheduleCommandError` wrapping the engine error envelope (code/message/remediation)
- [x] `engineSupportsSchedule` / `engineSupportsScheduleAutoPush` probes (default FALSE when unknown)
- [x] `driftStateFromStatus` pure mapping → never-run / clean / drift / failing

### Task 3: Settings persistence
**File**: `src/settings.ts`
- [x] `scheduleEnabled` (false), `scheduleTime` ('09:00'), `scheduleAutoPush` (false), `scheduleManifestPath` (null) with defaults + migration literals updated

### Task 4: Settings card
**File**: `src/components/app/settings/continuous-protection-setting.tsx`
- [x] Main toggle "Check this computer for drift daily" + time input (default 09:00)
- [x] Disabled-with-hint "Save this computer first" when no saved capture; turning OFF always allowed
- [x] Sub-toggle "Back up automatically when changes are found" rendered only when available

### Task 5: App wiring
**File**: `src/App.tsx`
- [x] Capability handshake: `scheduleSupported` / `scheduleAutoPushCapable` from capabilities; `schedule status` fetch when supported
- [x] Launch self-heal: persisted enabled preference → idempotent `schedule enable` re-assert
- [x] Handlers: toggle (enable/disable), time change, auto-push change — each re-asserts and refreshes status
- [x] Save-to-file records `scheduleManifestPath` and re-points an active schedule
- [x] "Continuous protection" card rendered adjacent to Automatic backup, gated on `scheduleSupported`
- [x] Drift chip props passed to `IntentLanding` from `driftStateFromStatus`

### Task 6: Drift chip
**File**: `src/components/app/intent/intent-landing.tsx`
- [x] Optional `driftCount` / `driftCheckedAt` / `driftCheckFailing` props
- [x] Amber "N apps drifted since your snapshot" chip (pluralised), precedence over "Scan complete"
- [x] Muted "Drift check failing" chip for last-run-failed; never-run/clean render nothing

### Task 7: Tests
- [x] `src/lib/schedule-bridge.test.ts` — CLI args, error wrapping, capability gating, status→UI mapping (never-run/clean/drift/failed/disabled)
- [x] `src/components/app/settings/continuous-protection-setting.test.tsx` — toggle consent, hint gating, sub-toggle availability, busy state
- [x] `src/components/app/intent/intent-landing.drift-chip.test.tsx` — chip states + precedence
- [x] `src/settings.test.ts` — schedule field defaults, round-trip, legacy-blob defaulting, migration preservation
