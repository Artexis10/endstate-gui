## Why

Production builds of endstate-gui bundle the Go engine binary as a Tauri sidecar (`externalBin`), but three connected bugs mean the bundled binary is never used. The GUI silently falls back to whatever `endstate` exists on the system PATH, causing users to run stale or missing engine versions without any indication.

## What Changes

- **Activate the `__bundled__` sidecar code path**: The frontend will pass the `"__bundled__"` sentinel to the Rust layer when `engineMode === 'bundled'`, activating the existing (currently dead) sidecar resolution branch in `engine_adapter.rs` that correctly sets `ENDSTATE_ROOT`.
- **Fix sidecar filename resolution**: The Rust `__bundled__` branch will look for both `endstate.exe` and the target-triple-suffixed filename (`endstate-x86_64-pc-windows-msvc.exe`) that Tauri's `externalBin` actually installs.
- **Remove silent PATH fallback**: When `engineMode === 'bundled'`, if the sidecar binary is not found, the system will surface an error to the user instead of silently falling back to PATH.
- **Expose bundled mode in settings UI**: Add "Bundled (recommended)" to the engine mode radio group so users can see and select all three modes.
- **Delete dead frontend resolution code**: Remove `get_bundled_engine_path` Tauri command and the frontend `invoke` call that tried (and failed) to resolve the sidecar path from TypeScript.

## Capabilities

### New Capabilities

_(none — this change fixes the implementation of an existing capability)_

### Modified Capabilities

- `engine-bundling`: Requirements change from PowerShell script bundling to Go binary sidecar. Sidecar resolution must handle target-triple filenames. Silent PATH fallback is removed for bundled mode. `ENDSTATE_ROOT` must be set by the Rust layer.

## Impact

- **Rust backend**: `engine_adapter.rs` (sidecar resolution in `__bundled__` branch), `lib.rs` (remove `resolve_bundled_engine_path` and `get_bundled_engine_path` command)
- **Frontend**: `src/lib/engine-exec.ts` (simplify `buildEngineCommand` for bundled mode), `src/App.tsx` (settings radio group)
- **No CLI contract changes**: The engine binary interface is unchanged
- **No new dependencies**: Uses existing Tauri resource/path APIs
