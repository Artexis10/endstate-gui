# Contract Validator Agent

Validate that changes maintain compatibility with the CLI-GUI contract and cross-repo coupling.

## What to Check

### EndstateEnvelope Contract
- All CLI calls must include `--json` flag
- Responses must be parsed as `EndstateEnvelope<T>`: `{ schemaVersion, cliVersion, command, runId, timestampUtc, success, data, error }`
- Non-zero exit codes are failures even if JSON is returned
- If stdout cannot be parsed as JSON, the run is failed
- GUI must refuse execution if `schemaVersion` is incompatible

### Streaming Event Contract
- Streaming text may be parsed for transient progress UI only
- Final state MUST derive from JSON envelope at command completion
- stderr may be displayed as diagnostics but MUST NOT affect state
- Type guards in `src/lib/streaming-events.ts` must align with engine event schema

### Event Type Guards
Verify these EngineEvent discriminators remain correct:
- `LogEvent`: `type === 'log'` with `level` and `message`
- `ResultEvent`: `type === 'result'` with `ok`, `command`, `summary`
- `CliEnvelopeEvent`: has `success`, `command`, `data` fields
- Changes to type guards can silently break all event handling

### Status Mapping Contract
If `src/lib/apply-utils.ts` is modified, verify:
- `engineStatusToStatusKey()` correctly maps engine statuses to GUI StatusKeys
- `getPhaseAwareStatusForEvent()` respects the phase-aware resolution rules from `docs/ux-language.md`
- `UI_STATUS_MAP` and `PHASE_STATUS_MAP` match the canonical mapping tables

### Cross-Repo Coupling
Changes to these areas affect both GUI and engine repos:
- Status/phase semantics: `docs/ux-language.md` (GUI) ↔ `../endstate/docs/event-contract.md` (engine)
- Event schema: field names, event types, reason codes
- Flag if a change requires a corresponding engine update

### Profile Contract
- Profiles are visible folders in `Documents/Endstate/Profiles`
- Profile validation follows `docs/profile-contract.md`
- No hidden profile state in AppData

## Reference Files
- `src/types.ts` — `EndstateEnvelope<T>` and data types
- `src/lib/streaming-events.ts` — event parsing and type guards
- `src/lib/apply-utils.ts` — status mapping implementation
- `src/engine-bridge.ts` — engine abstraction layer (PROTECTED)
- `docs/ux-language.md` — canonical status/phase tables

## Output Format

- **BREAK**: Contract violation that will cause runtime failures — must fix
- **COUPLING**: Change requires corresponding update in engine repo — flag to user
- **DRIFT**: Implementation may have drifted from contract docs — verify
- **OK**: No contract issues found
