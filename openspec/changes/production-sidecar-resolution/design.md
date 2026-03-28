## Context

The GUI bundles the Go engine binary via Tauri's `externalBin` mechanism and engine resources (modules/, payload/, VERSION, SCHEMA_VERSION) via `bundle.resources`. Three bugs prevent the bundled binary from ever being used:

1. The frontend resolves the sidecar path itself via `get_bundled_engine_path` and passes the full path as `exe`. The Rust `__bundled__` branch (which sets `ENDSTATE_ROOT`) checks for the literal string `"__bundled__"` and is never triggered.
2. The frontend resolution looks for `endstate.exe` but Tauri installs the sidecar with a target-triple suffix (`endstate-x86_64-pc-windows-msvc.exe`).
3. On any failure, the frontend silently falls back to PATH lookup with no user-visible indication.

## Goals / Non-Goals

**Goals:**
- Production `bundled` mode uses the sidecar binary with `ENDSTATE_ROOT` set correctly
- Sidecar resolution handles Tauri's target-triple filename convention
- Failed sidecar resolution produces a user-visible error, not a silent PATH fallback
- Settings UI exposes all three engine modes
- `tauri dev` continues to work (dev fallback to PATH is acceptable, but only in dev)

**Non-Goals:**
- Changing the Go engine binary interface or CLI contract
- Modifying the `externalBin` or `resources` config in `tauri.conf.json` (already correct)
- Cross-platform support beyond Windows (current target)
- Changing the `endstate_exec` (non-streaming) path — it already receives the resolved `exe` string and will benefit from the same fix

## Decisions

### Decision 1: Frontend passes `"__bundled__"` sentinel, Rust owns resolution

The frontend will pass `exe: "__bundled__"` when `engineMode === 'bundled'`. All sidecar path resolution and `ENDSTATE_ROOT` injection happens in Rust.

**Alternative considered**: Fixing the frontend resolution to handle triple-suffixed filenames and somehow passing `ENDSTATE_ROOT`. Rejected because the Rust layer already has the correct logic (resource directory access via `app.path().resource_dir()`), and duplicating resource path resolution in TypeScript would be fragile.

### Decision 2: Rust scans for both plain and triple-suffixed filenames

The `__bundled__` branch in `engine_adapter.rs` will look for sidecar candidates in order:
1. `endstate-x86_64-pc-windows-msvc.exe` (Tauri production install)
2. `endstate.exe` (dev mode, where `rebuild-engine.cjs` copies without triple)

This handles both production installs and `tauri dev` without conditional compilation.

### Decision 3: Remove `get_bundled_engine_path` command entirely

The Tauri command `get_bundled_engine_path` and its backing function `resolve_bundled_engine_path()` are deleted. The frontend no longer needs to resolve the sidecar path — it delegates entirely to Rust via the `"__bundled__"` sentinel.

### Decision 4: ALL spawn sites handle `"__bundled__"` — including `run_endstate_streaming`

Every Rust function that spawns the engine must check for the `"__bundled__"` sentinel:
- `run_engine()` in `engine_adapter.rs` (streaming via event channel) — already has it
- `endstate_exec()` in `lib.rs` (non-streaming) — already has it
- `run_endstate_streaming()` in `lib.rs` (streaming via simple stdout/stderr) — **must be added**

The shared `build_bundled_command()` helper is called by all three.

### Decision 5: Suppress console windows on Windows with CREATE_NO_WINDOW

On Windows, spawning a child process without CREATE_NO_WINDOW allocates a visible console window. Both `build_bundled_command()` and `build_engine_command()` will set `creation_flags(0x08000000)` behind `#[cfg(target_os = "windows")]`. This covers all downstream spawn sites.

### Decision 6: Explicit `.env.production` prevents license bypass leaking into builds

Vite reads `VITE_`-prefixed vars from the process environment, not just `.env` files. If the build machine has `VITE_DEV_BYPASS_LICENSE=1` set (e.g., from a shell profile), it gets baked into the production bundle. A `.env.production` file with `VITE_DEV_BYPASS_LICENSE=0` provides an explicit override that Vite loads in production mode.

### Decision 7: streaming-runner.ts uses `__bundled__` sentinel

The frontend `streaming-runner.ts` currently sets `exe = 'endstate'` for bundled mode, bypassing the Rust sidecar resolution entirely. It must use `exe = '__bundled__'` to match `engine-exec.ts` behavior.

## Risks / Trade-offs

- **[Risk] Dev mode with no engine binary**: In dev, if `rebuild-engine.cjs` hasn't run and no binary exists at `target/debug/endstate.exe`, bundled mode will fail. → **Mitigation**: The `predev` script already handles this. Dev users who skip it can switch to `path` mode in settings.
- **[Risk] Hardcoded target triple**: `x86_64-pc-windows-msvc` is hardcoded. → **Mitigation**: This is the only supported platform currently. When adding platforms, the triple list expands in one place (the Rust resolution function).
- **[Risk] Existing users with `engineMode: 'path'` in localStorage**: Users who previously changed settings won't automatically switch to bundled. → **Mitigation**: Acceptable — they chose that mode. The settings UI will now show all options so they can switch.
