## MODIFIED Requirements

### Requirement: Three engine resolution modes

The system SHALL support three engine resolution modes: bundled (production default), PATH, and script.

#### Scenario: Bundled mode resolves sidecar binary via Rust layer
- **WHEN** engineMode is "bundled"
- **AND** the frontend invokes engine execution
- **THEN** the frontend SHALL pass the sentinel value `"__bundled__"` as the executable parameter
- **AND** the Rust layer SHALL resolve the sidecar binary from the directory containing the main executable
- **AND** the Rust layer SHALL look for the target-triple-suffixed filename (`endstate-x86_64-pc-windows-msvc.exe`) first, then `endstate.exe` as fallback
- **AND** the Rust layer SHALL set `ENDSTATE_ROOT` to the Tauri resource directory's `engine/` subdirectory

#### Scenario: Bundled mode surfaces error when sidecar not found
- **WHEN** engineMode is "bundled"
- **AND** the sidecar binary is not found at any expected location
- **THEN** the system SHALL return an error with code `BUNDLED_ENGINE_NOT_FOUND`
- **AND** the error message SHALL include the paths that were searched
- **AND** the system SHALL NOT fall back to PATH resolution

#### Scenario: Bundled mode in dev falls back within Rust resolution
- **WHEN** engineMode is "bundled"
- **AND** the app is running from `target/debug/`
- **THEN** the Rust layer SHALL find `endstate.exe` placed by the predev rebuild script
- **AND** `ENDSTATE_ROOT` SHALL be set to the Tauri resource directory's `engine/` subdirectory

#### Scenario: PATH mode resolves from system PATH
- **WHEN** engineMode is "path"
- **THEN** the engine is resolved as "endstate" from system PATH

#### Scenario: Script mode uses configured path
- **WHEN** engineMode is "script"
- **THEN** the engine is resolved from the user-configured script path

### Requirement: Settings UI exposes all engine modes

The settings UI SHALL display all three engine resolution modes with clear labels.

#### Scenario: All modes visible in settings
- **WHEN** the user opens the settings panel
- **THEN** the engine mode radio group SHALL show three options: "Bundled (recommended)", "System PATH (development)", and "Script (legacy)"
- **AND** the default for new installations SHALL be "bundled"

### Requirement: Engine tree is included in NSIS installer

The Tauri build SHALL bundle the engine Go binary via `externalBin` and engine resources (modules/, payload/, VERSION, SCHEMA_VERSION) via `bundle.resources`.

#### Scenario: Build includes engine binary and resources
- **WHEN** `npm run tauri build` is executed
- **AND** `../../endstate/go-engine/` exists with the engine binary
- **THEN** the installer includes the engine binary as a sidecar
- **AND** the installer includes engine/modules/, engine/payload/, engine/VERSION, engine/SCHEMA_VERSION as resources

### Requirement: Console window suppression on Windows

Child processes spawned by the GUI SHALL NOT display a visible console window.

#### Scenario: Engine spawn does not flash a terminal window
- **WHEN** the GUI spawns the engine binary on Windows
- **THEN** the process SHALL be created with the `CREATE_NO_WINDOW` flag (0x08000000)
- **AND** no visible console window SHALL appear to the user
- **AND** this SHALL apply to both `build_bundled_command` and `build_engine_command` spawn sites

### Requirement: License bypass protection in production builds

The `VITE_DEV_BYPASS_LICENSE` environment variable SHALL NOT leak into production builds.

#### Scenario: Production build has license gate active
- **WHEN** `npm run tauri build` executes
- **THEN** `.env.production` SHALL set `VITE_DEV_BYPASS_LICENSE=0`
- **AND** the license gate SHALL be active in the resulting binary regardless of the build machine's environment variables

### Requirement: Streaming path uses bundled sidecar

The streaming execution path SHALL use the bundled sidecar when `engineMode === 'bundled'`.

#### Scenario: Streaming runner passes bundled sentinel
- **WHEN** `engineMode` is `'bundled'`
- **AND** the streaming runner invokes the engine
- **THEN** the frontend SHALL pass `exe = '__bundled__'` to the Tauri command
- **AND** `run_endstate_streaming` in Rust SHALL resolve the sidecar via `build_bundled_command`
- **AND** `ENDSTATE_ROOT` SHALL be set to the resource directory's `engine/` subdirectory

## REMOVED Requirements

### Requirement: Frontend resolves bundled engine path
**Reason**: Sidecar resolution is now fully owned by the Rust layer via the `"__bundled__"` sentinel. The `get_bundled_engine_path` Tauri command and frontend invoke are removed.
**Migration**: Frontend passes `"__bundled__"` as exe; Rust handles all resolution.
