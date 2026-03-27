# Schema Version Compatibility

## Purpose

The GUI refuses to execute engine commands if the engine's schema version is outside the GUI's declared compatible range. This prevents silent data misinterpretation when the GUI and engine are out of sync.

## Requirements

### Requirement: GUI declares a compatible schema version range

The GUI SHALL declare its compatible engine schema version range in `src/lib/compat.ts` as `ENGINE_SCHEMA_COMPAT` with `min` and `max` fields.

#### Scenario: Compatibility range is defined
- **WHEN** the GUI is built
- **THEN** `ENGINE_SCHEMA_COMPAT` is available as a typed constant with `min` and `max` semver-style strings

### Requirement: GUI refuses execution on incompatible schema

The GUI SHALL check the engine's reported `schemaVersion` against its declared compatible range and refuse execution if the version is outside that range.

#### Scenario: Schema version within range
- **WHEN** the engine envelope reports a `schemaVersion` within the GUI's `[min, max]` range
- **THEN** the GUI processes the envelope normally

#### Scenario: Schema version too old
- **WHEN** the engine envelope reports a `schemaVersion` below the GUI's `min`
- **THEN** the GUI rejects the result and displays an error indicating the engine is outdated

#### Scenario: Schema version too new
- **WHEN** the engine envelope reports a `schemaVersion` above the GUI's `max`
- **THEN** the GUI rejects the result and displays an error indicating the GUI needs updating
