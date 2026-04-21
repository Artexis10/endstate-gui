## Context

The Endstate engine was rewritten from PowerShell to Go. The Go binary (`endstate.exe`) is a single static executable that produces identical JSON output to the PowerShell scripts. The current GUI bundles the entire PowerShell script tree (8 directories) as Tauri resources and invokes them through complex wrapping: CMD /C for .cmd PATH shims, PowerShell -NoProfile -ExecutionPolicy Bypass for .ps1 scripts, ENDSTATE_ALLOW_DIRECT env var, and \\?\ extended path prefix stripping. All of this complexity exists solely because the engine was PowerShell scripts, not a native binary.

The Go binary eliminates the need for PowerShell entirely. It can be spawned directly as a child process with no wrapping. Tauri v2 supports sidecar binaries via `externalBin` which handles platform-specific naming and path resolution automatically.

Key files:
- `src-tauri/tauri.conf.json` — bundle config (8 resource directories → sidecar + data)
- `src-tauri/src/cmd_impl.rs` — command builder with PowerShell wrapping (simplify)
- `src-tauri/src/engine_adapter.rs` — streaming adapter, bundled engine resolution (update)
- `src-tauri/src/lib.rs` — `get_bundled_engine_path` Tauri command (update or remove)
- `src/lib/engine-exec.ts` — frontend `buildEngineCommand()` with 3 modes (simplify bundled mode)
- `src/streaming-runner.ts` — streaming exec (bundled/path already use `exe='endstate'`)
- `src/settings.ts` — engine mode settings

## Goals / Non-Goals

**Goals:**
- Replace PowerShell engine bundling with Go sidecar binary
- Simplify `build_engine_command()` — remove all PowerShell invocation wrapping
- Remove `build_bundled_engine_command()` and `strip_extended_path_prefix()` (PowerShell-only)
- Update `engine_adapter.rs` bundled mode to resolve Go sidecar instead of .ps1
- Set ENDSTATE_ROOT so Go binary locates modules/ and payload/
- Keep all three engine modes (bundled/path/script) working
- Maintain identical JSON contract surface — no frontend behavior changes

**Non-Goals:**
- Modifying Go engine source code
- Changing JSON contract format between engine and GUI
- Removing script mode (kept for dev with custom engine builds)
- Automating Go binary builds (document as manual step for now)
- Changing any user-facing UI or behavior

## Decisions

### Decision 1: Tauri externalBin sidecar for bundled mode

Use Tauri v2's `externalBin` to bundle the Go binary as a sidecar. The binary must follow Tauri's platform-triple naming convention: `endstate-x86_64-pc-windows-msvc.exe` at build time, resolved automatically at runtime.

**Why over resources:** Tauri sidecars get proper process lifecycle management, PATH resolution, and platform-specific binary naming for free. Resources would require manual path resolution and lack platform awareness.

**Why over PATH resolution:** In production builds, we can't assume `endstate` is on PATH. The sidecar mechanism bundles the binary alongside the app and provides a reliable resolution path.

### Decision 2: ENDSTATE_ROOT for data directory resolution

Set `ENDSTATE_ROOT` environment variable pointing to the Tauri resource directory containing modules/ and payload/. The Go binary uses this to locate its data files at runtime.

In dev mode, ENDSTATE_ROOT is set from the environment (pointing to the sibling endstate repo). In production, it's set to the Tauri resource directory's engine/ subdirectory.

**Why env var over CLI flag:** The Go binary already supports ENDSTATE_ROOT. Using the same mechanism avoids adding new CLI flags.

### Decision 3: Keep data directories as resources

modules/, payload/, VERSION, and SCHEMA_VERSION continue as Tauri `bundle.resources` under engine/. Only the executable changes from resource to sidecar.

**Why not bundle everything in sidecar:** The Go binary is a standalone executable; the data directories are runtime configuration that may vary independently. Keeping them as resources matches how the Go binary expects to find them via ENDSTATE_ROOT.

### Decision 4: Simplify build_engine_command to trivial Command::new

With a native Go binary, `build_engine_command()` becomes `Command::new(exe).args(args)`. No CMD /C wrapping, no PowerShell invocation, no ENDSTATE_ALLOW_DIRECT. The function still sets ENDSTATE_ROOT if available.

### Decision 5: Update frontend bundled mode to use sidecar

The frontend `buildEngineCommand()` bundled mode currently calls `invoke('get_bundled_engine_path')` to get the .ps1 path, then wraps with PowerShell args. With the Go sidecar, bundled mode becomes identical to path mode: `exe='endstate'`, args passed directly. The Tauri sidecar mechanism handles resolution.

The `get_bundled_engine_path` Rust command should either return the sidecar path or be removed if the frontend no longer needs it.

### Decision 6: Keep script mode as-is (legacy)

Script mode (`pwsh -File <path>`) is kept for development with custom PowerShell engine builds. This is a niche use case but costs nothing to maintain.

## Risks / Trade-offs

- **[Risk] Go binary not built before tauri build** → Document that Go binary must be pre-built and placed at expected path with platform-triple naming. Add note to README or CLAUDE.md.
- **[Risk] ENDSTATE_ROOT not set in production** → Production bundled mode MUST set ENDSTATE_ROOT to the resource directory. Verify in engine_adapter.rs bundled code path.
- **[Risk] Sidecar naming mismatch** → Tauri requires exact platform-triple naming. If the Go binary isn't named correctly, build fails silently. Document the naming convention.
- **[Risk] Existing cmd_impl.rs tests reference PowerShell wrapping** → Tests must be updated to reflect simplified command building. Tests for removed functions must be removed.
- **[Risk] Users with script mode pointing to .ps1** → No impact. Script mode still works with PowerShell scripts. Only bundled and path modes change.
