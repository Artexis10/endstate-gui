## Why

The Endstate engine was rewritten from PowerShell to Go as a single static binary. The current GUI bundles 8 PowerShell resource directories and uses complex invocation wrapping (CMD /C, -NoProfile -ExecutionPolicy Bypass, ENDSTATE_ALLOW_DIRECT, \\?\ path prefix stripping) that is no longer needed. Replacing the PowerShell engine tree with the Go binary simplifies the build, reduces installer size, and eliminates an entire class of Windows path/execution bugs.

## What Changes

- **Remove** 8 PowerShell resource directories from `tauri.conf.json` bundle (bin/, engine/, drivers/, restorers/, verifiers/, modules/, bundles/, payload/) and replace with Go sidecar binary + data-only resources (modules/, payload/, VERSION, SCHEMA_VERSION)
- **Add** Go binary as a Tauri v2 `externalBin` sidecar with platform-specific naming
- **Simplify** `cmd_impl.rs` `build_engine_command()` — remove all PowerShell invocation wrapping (CMD /C, -NoProfile, -ExecutionPolicy Bypass, ENDSTATE_ALLOW_DIRECT env var, extended path prefix stripping)
- **Remove** `build_bundled_engine_command()` and `strip_extended_path_prefix()` from `cmd_impl.rs` — both are PowerShell-specific
- **Update** `engine_adapter.rs` bundled engine resolution from .ps1 entrypoint to Go sidecar binary path
- **Set** `ENDSTATE_ROOT` environment variable so Go binary can locate modules/ and payload/ at runtime
- **Update** frontend engine resolution for bundled mode (currently resolves .ps1 path via Tauri invoke)
- No user-facing behavior change — same JSON contracts, same GUI functionality

## Capabilities

### New Capabilities
_(none — this is a backend engine swap with identical contracts)_

### Modified Capabilities
- `engine-bundling`: Engine resolution changes from PowerShell script tree to Go sidecar binary. Three-mode resolution stays but bundled mode resolves a Go exe instead of .ps1 scripts. Resource bundle changes from 8 directories to sidecar + data directories.

## Impact

- **Rust backend**: `cmd_impl.rs` (major simplification), `engine_adapter.rs` (bundled path resolution), `lib.rs` (bundled engine path command)
- **Frontend**: `engine-exec.ts` and `streaming-runner.ts` (bundled mode path resolution), `settings.ts` (possible default/mode updates)
- **Build config**: `tauri.conf.json` (resources → externalBin + reduced resources), `package.json` (predev/prebuild hooks)
- **Dependencies**: Go toolchain required at build time (or pre-built binary)
- **Installer**: NSIS installer bundles Go exe instead of PowerShell tree — smaller installer
- **Existing tests**: `cmd_impl.rs` unit tests need updating (PowerShell-specific tests removed). `engine_adapter.rs` tests unchanged. Frontend tests unchanged (mock layer).
