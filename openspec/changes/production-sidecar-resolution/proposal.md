## Why

Production builds of endstate-gui bundle the Go engine binary as a Tauri sidecar (`externalBin`), but three connected bugs mean the bundled binary is never used. The GUI silently falls back to whatever `endstate` exists on the system PATH, causing users to run stale or missing engine versions without any indication.

## What Changes

- **Activate the `__bundled__` sidecar code path in ALL spawn sites**: The frontend streaming-runner and engine-exec will pass `"__bundled__"` sentinel when `engineMode === 'bundled'`. Rust's `run_endstate_streaming` gains the same `__bundled__` branch that `run_engine` and `endstate_exec` already have, so capture/apply/verify all resolve the sidecar and set `ENDSTATE_ROOT`.
- **Fix sidecar filename resolution**: The Rust `__bundled__` branch will look for both `endstate.exe` and the target-triple-suffixed filename (`endstate-x86_64-pc-windows-msvc.exe`) that Tauri's `externalBin` actually installs.
- **Remove silent PATH fallback**: When `engineMode === 'bundled'`, if the sidecar binary is not found, the system will surface an error to the user instead of silently falling back to PATH.
- **Suppress console window on Windows**: Add `CREATE_NO_WINDOW` (0x08000000) creation flag to all child process spawn sites (`build_bundled_command` and `build_engine_command`) so no terminal window flashes during engine operations.
- **Prevent license bypass leak into production**: Create `.env.production` with `VITE_DEV_BYPASS_LICENSE=0` as an explicit override, preventing build-time env contamination from the dev bypass.
- **Expose bundled mode in settings UI**: Add "Bundled (recommended)" to the engine mode radio group so users can see and select all three modes.
- **Delete dead frontend resolution code**: Remove `resolve_bundled_engine_path()` Tauri command from `lib.rs` and its command registration.

## Capabilities

### New Capabilities

_(none — this change fixes the implementation of an existing capability)_

### Modified Capabilities

- `engine-bundling`: Requirements change from PowerShell script bundling to Go binary sidecar. Sidecar resolution must handle target-triple filenames. Silent PATH fallback is removed for bundled mode. `ENDSTATE_ROOT` must be set by the Rust layer.

## Impact

- **Rust backend**: `engine_adapter.rs` (sidecar resolution, CREATE_NO_WINDOW flag), `cmd_impl.rs` (CREATE_NO_WINDOW flag), `lib.rs` (`run_endstate_streaming` `__bundled__` branch, remove `resolve_bundled_engine_path`)
- **Frontend**: `src/streaming-runner.ts` (bundled mode sentinel), `src/lib/engine-exec.ts` (remove silent fallback), `src/App.tsx` (settings radio group)
- **Build**: `.env.production` (license bypass protection)
- **No CLI contract changes**: The engine binary interface is unchanged
- **No new dependencies**: Uses existing Tauri resource/path APIs and `std::os::windows::process::CommandExt`
