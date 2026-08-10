## Why

The engine now ships a `schedule` command family (scheduled drift check via Windows Task Scheduler; engine OpenSpec change `scheduled-drift-check`, contract section "Command: schedule"). The GUI needs the consumer half — "Scheduled setup checks": a Settings toggle that registers the daily check, launch-time status wiring, and a drift chip on the landing screen — while staying a thin presentation layer (no drift logic client-side) and remaining completely dark against engines that predate the feature (bundled ≤ 2.21).

## What Changes

- `src/types.ts`: capabilities gain `features.schedule { supported, autoPush }`; new `ScheduleStatusData` / `ScheduleEnableData` / `ScheduleDisableData` and nested last-run types matching `endstate schedule * --json`
- `src/lib/schedule-bridge.ts` (new, mirrors `backup-bridge.ts`): `scheduleEnable` / `scheduleDisable` / `scheduleStatus` via `runEndstateOnce`, `ScheduleCommandError`, `engineSupportsSchedule` / `engineSupportsScheduleAutoPush` capability probes, and the pure `driftStateFromStatus` status→chip mapping
- `src/settings.ts`: persisted preferences `scheduleEnabled`, `scheduleTime` (default `09:00`), `scheduleAutoPush`, `scheduleManifestPath` (the saved-capture baseline)
- Settings page: "Scheduled setup checks" card adjacent to Automatic backup — main toggle "Check this computer for drift daily" (the toggle IS the consent), time input, and a "Upload the saved setup to Endstate Cloud" sub-toggle gated on `autoBackupAvailable` AND `features.schedule.autoPush`; enabling requires a saved capture ("Save this computer first" hint otherwise)
- `src/App.tsx` launch wiring: after the capabilities handshake, when `features.schedule.supported` → fetch `schedule status`; if the persisted preference says enabled, re-assert `schedule enable` (idempotent self-heal); saving a capture to file records it as the baseline and re-points an active schedule
- `intent-landing.tsx`: optional `driftCount` / `driftCheckedAt` / `driftCheckFailing` props; amber "N apps drifted since your snapshot" chip on the Save card (precedence over "Scan complete"), muted "Drift check failing" chip on hard errors; never-run/clean render nothing

## Capabilities

### New Capabilities

- `continuous-protection-ui`: GUI surface for the engine's scheduled drift check — capability-gated Settings card, persisted preferences with launch self-heal, and engine-status-driven drift chip.

### Modified Capabilities

_(none — additive; existing surfaces unchanged when the engine lacks `features.schedule`)_

## Impact

- `src/types.ts` — Modified: schedule capability + response types
- `src/settings.ts` — Modified: four persisted schedule fields
- `src/lib/schedule-bridge.ts` — New: bridge, probes, drift mapping (+ tests)
- `src/components/app/settings/continuous-protection-setting.tsx` — New: settings control (+ tests)
- `src/components/app/intent/intent-landing.tsx` — Modified: drift chip slot (+ tests)
- `src/App.tsx` — Modified: state, handshake/self-heal, handlers, settings card, chip wiring, save-to-file baseline recording
- Existing test fixtures constructing full `AppSettings` literals — Modified: new fields with defaults
