## ADDED Requirements

### Requirement: EndstateCapabilitiesData includes engine version fields

The system SHALL define optional `gitCommit`, `gitDirty`, and `bootstrapTimestamp` fields on the `EndstateCapabilitiesData` type.

#### Scenario: Type accepts version fields from engine
- **WHEN** the capabilities envelope contains `gitCommit: "abc1234"`, `gitDirty: false`, `bootstrapTimestamp: "2026-02-27T03:04:38Z"`
- **THEN** the parsed `EndstateCapabilitiesData` includes those fields

#### Scenario: Type accepts null/absent version fields
- **WHEN** the capabilities envelope has no `gitCommit`, `gitDirty`, or `bootstrapTimestamp` fields
- **THEN** the parsed `EndstateCapabilitiesData` has those fields as `undefined`

### Requirement: Dev-mode console logging of engine version

The system SHALL log engine version info to the browser console in dev mode after a successful capabilities handshake.

#### Scenario: Engine has version info
- **WHEN** dev mode is active and capabilities data includes `gitCommit: "abc1234"`, `gitDirty: false`, `bootstrapTimestamp: "2026-02-27T03:04:38Z"`
- **THEN** console logs `[ENGINE] gitCommit=abc1234 dirty=false bootstrapped=2026-02-27T03:04:38Z`

#### Scenario: Engine has no gitCommit (stale copy)
- **WHEN** dev mode is active and capabilities data has `gitCommit` as null or undefined
- **THEN** console warns `[ENGINE WARNING] No gitCommit in capabilities — likely running stale bootstrapped copy. Consider using script mode or re-bootstrapping.`

#### Scenario: Production mode
- **WHEN** dev mode is NOT active
- **THEN** no engine version logging occurs

### Requirement: Pre-dev bootstrap hook

The system SHALL include a `predev` npm script that re-bootstraps the engine before the Tauri dev server starts.

#### Scenario: Bootstrap runs before dev
- **WHEN** developer runs `npm run tauri dev` (which triggers `predev` via Tauri config)
- **THEN** the endstate bootstrap command executes first

#### Scenario: Bootstrap failure is non-fatal
- **WHEN** the bootstrap command fails
- **THEN** the dev server starts normally (non-fatal hook)
