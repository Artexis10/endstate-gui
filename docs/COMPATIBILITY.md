# Compatibility Matrix

## GUI <-> Engine Schema Compatibility

| GUI Version | Engine Schema Range | Notes |
|-------------|-------------------|-------|
| 0.1.x       | 1.0 -- 1.0         | Initial release |

## Version Sync

The GUI maintains version consistency across three files:
- `package.json` -- npm/Node version
- `src-tauri/tauri.conf.json` -- Tauri app version
- `src-tauri/Cargo.toml` -- Rust crate version

All three MUST match at all times. Use `npm run version:check` to validate.

## Schema Compatibility Declaration

The file `src/lib/compat.ts` declares the engine schema version range this GUI version supports via `ENGINE_SCHEMA_COMPAT`.
