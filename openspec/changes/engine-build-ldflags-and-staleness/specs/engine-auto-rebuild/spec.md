## MODIFIED Requirements

### Requirement: predev script rebuilds the engine

The `predev` npm script SHALL rebuild (bootstrap) the engine binary before starting the development server, ensuring the GUI runs against current engine code. The build SHALL embed version and schema version via `-ldflags`.

#### Scenario: Build embeds version via ldflags
- **WHEN** the rebuild script compiles the engine
- **THEN** it passes `-ldflags` with `version` and `schemaVersion` read from `VERSION` and `SCHEMA_VERSION` files in the engine repo root
- **AND** the built binary reports the correct `cliVersion` and `schemaVersion` via `capabilities --json`

## ADDED Requirements

### Requirement: Production builds reject stale engine source

The build script SHALL block production builds when the local engine repo is behind origin/main.

#### Scenario: Strict mode blocks stale engine
- **WHEN** `STRICT_ENGINE_BUILD=1` is set
- **AND** the local engine repo is behind `origin/main`
- **THEN** the build script exits with non-zero code
- **AND** prints the number of commits behind and remediation command

### Requirement: Dev builds warn on stale engine source

The build script SHALL warn during dev builds when the local engine repo is behind origin/main.

#### Scenario: Lenient mode warns on stale engine
- **WHEN** `STRICT_ENGINE_BUILD` is not set
- **AND** the local engine repo is behind `origin/main`
- **THEN** the build script prints a warning
- **AND** continues normally

### Requirement: Staleness check tolerates offline

The build script SHALL not block builds when network is unavailable.

#### Scenario: Git fetch fails gracefully
- **WHEN** `git fetch` fails (network unavailable)
- **THEN** the build script prints a warning about inability to check staleness
- **AND** continues (does not block)
