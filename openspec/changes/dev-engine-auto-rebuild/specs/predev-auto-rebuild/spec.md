## ADDED Requirements

### Requirement: Predev script rebuilds engine binary before dev server

The `predev` npm script SHALL execute `node scripts/rebuild-engine.js` which runs `go build` in the engine repo and copies the resulting binary to the sidecar location.

#### Scenario: Engine binary is rebuilt on npm run dev
- **WHEN** `npm run dev` or `npm run tauri dev` is executed
- **THEN** the predev script runs `go build` in the sibling engine repo
- **AND** copies the resulting binary to the Tauri sidecar triple location and `src-tauri/target/debug/`

#### Scenario: Build is skipped when SKIP_ENGINE_BUILD is set
- **WHEN** `SKIP_ENGINE_BUILD=1` is set in the environment
- **THEN** the predev script skips the `go build` step
- **AND** proceeds without rebuilding the engine binary

#### Scenario: Graceful degradation without Go toolchain
- **WHEN** the Go toolchain is not available on the system
- **THEN** the predev script logs a warning
- **AND** does not fail the dev server startup

## MODIFIED Requirements

### Requirement: Predev script uses build-then-copy instead of copy-only

The `predev` npm script SHALL build the engine binary from source before copying, replacing the previous copy-only behavior.

#### Scenario: Predev builds then copies
- **WHEN** the predev script executes
- **THEN** it first runs `go build` to produce a fresh binary
- **AND** then copies the binary to the expected locations
- **AND** this replaces the previous behavior of only copying a pre-built binary
