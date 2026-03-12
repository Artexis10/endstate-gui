# Endstate GUI — Go Engine Sidecar Integration

## Pre-Flight

Make sure you're in the GUI repo on the integration branch:
```powershell
cd C:\Users\win-laptop\Desktop\projects\endstate-gui
git checkout feature/go-engine-integration
```

---

## Step 1: OpenSpec Change (run in Claude Code)

```
/opsx:ff go-engine-sidecar-integration
```

When it asks what you want to build, say:

> Replace PowerShell engine bundling with Go binary sidecar. The Endstate engine was rewritten from PowerShell to Go as a single static binary. This change swaps the 8 PowerShell resource directories (bin/, engine/, drivers/, restorers/, verifiers/, modules/, bundles/, payload/) for a single Go exe as a Tauri externalBin sidecar, plus only the data directories the Go binary needs at runtime (modules/, payload/, VERSION, SCHEMA_VERSION). Simplify cmd_impl.rs to remove all PowerShell invocation wrapping (CMD /C, -NoProfile -ExecutionPolicy Bypass, ENDSTATE_ALLOW_DIRECT, extended path prefix stripping). Set ENDSTATE_ROOT so the Go binary can find modules and payload. No user-facing behavior change — same JSON contracts, same GUI functionality, different engine binary underneath.

---

## Step 2: Implementation (paste into Claude Code after OpenSpec completes)

```
Integrate the Go engine binary as a Tauri sidecar in endstate-gui. We're on the `feature/go-engine-integration` branch. Read the OpenSpec change at `openspec/changes/go-engine-sidecar-integration/` for context.

## Background

The Endstate engine was rewritten from PowerShell to Go. The Go binary is a single exe at `../endstate/go-engine/endstate.exe` that produces identical JSON output to the PowerShell scripts. The GUI currently bundles the entire PowerShell script tree as Tauri resources and spawns them via PowerShell with complex wrapping. Replace all of that with the Go binary.

## Current Architecture (read these files carefully)

- `src-tauri/tauri.conf.json` — bundles 8 PowerShell directories as resources under "bundle.resources"
- `src-tauri/src/cmd_impl.rs` — `build_engine_command()` with PowerShell wrapping (CMD /C for .cmd shims, -NoProfile -ExecutionPolicy Bypass -File for .ps1, ENDSTATE_ALLOW_DIRECT env var, \\?\ path prefix stripping). Also has `build_bundled_engine_command()` and `strip_extended_path_prefix()` — both PowerShell-specific.
- `src-tauri/src/engine_adapter.rs` — streaming adapter that spawns engine process via `build_engine_command()`, reads stdout/stderr, emits NDJSON events
- `src-tauri/src/lib.rs` — Tauri command wrappers that delegate to cmd_impl and engine_adapter
- `src/lib/engine-exec.ts` — frontend non-streaming execution with 3 modes (script/bundled/path). Both bundled and path modes already use `exe = 'endstate'` with args passed directly.
- `src/streaming-runner.ts` — frontend streaming execution. Both bundled and path modes already use `exe = 'endstate'` with args passed directly.
- `src/settings.ts` — AppSettings with engineMode: 'bundled' | 'path' | 'script'. Default is 'bundled'.

## Key Insight

The frontend ALREADY works with the Go binary in both `bundled` and `path` modes — it sends `exe = 'endstate'` and passes args directly. The complexity is all in the Rust backend's `build_engine_command()` which wraps with CMD /C and PowerShell. With a Go .exe binary, none of that wrapping is needed.

## Changes Required

### 1. src-tauri/tauri.conf.json

Replace the old PowerShell resource bundle with Go sidecar + data directories:

**Remove** the entire current `bundle.resources` block (8 PowerShell directories).

**Add** `externalBin` for the Go binary. Tauri v2 sidecars require platform-specific binary naming. The binary must be named `endstate-x86_64-pc-windows-msvc` (no .exe — Tauri appends it). Look up Tauri v2 sidecar docs via Context7 MCP if available.

```json
{
  "bundle": {
    "externalBin": [
      "../endstate/go-engine/endstate"
    ],
    "resources": {
      "../../endstate/modules/": "engine/modules/",
      "../../endstate/payload/": "engine/payload/",
      "../../endstate/VERSION": "engine/VERSION",
      "../../endstate/SCHEMA_VERSION": "engine/SCHEMA_VERSION"
    }
  }
}
```

**IMPORTANT:** Check the Tauri v2 docs for the exact `externalBin` format. The binary at `../endstate/go-engine/endstate.exe` may need to be renamed or a symlink created with the platform triple suffix. Read https://v2.tauri.app/develop/sidecar/ or use Context7.

### 2. src-tauri/src/cmd_impl.rs — Simplify build_engine_command

The current function has 3 code paths: .ps1 scripts → PowerShell invocation, bare commands → CMD /C wrapping, PowerShell exe → ENDSTATE_ALLOW_DIRECT. With the Go binary, ALL of this is unnecessary.

**Replace** the current `build_engine_command()` with:

```rust
/// Build a Command for the engine binary.
///
/// With the Go engine, this is trivially simple — just spawn the exe with args.
/// Sets ENDSTATE_ROOT if available so the binary can find modules/ and payload/.
///
/// Development: resolves "endstate" from PATH
/// Production: Tauri sidecar resolves the bundled binary path
pub fn build_engine_command(exe: &str, args: &[String]) -> Command {
    let mut cmd = if exe.ends_with(".exe") || exe.contains('\\') || exe.contains('/') {
        // Absolute or relative path — use directly
        Command::new(exe)
    } else {
        // Bare command name — resolve from PATH
        Command::new(exe)
    };
    cmd.args(args);

    // Set ENDSTATE_ROOT so the Go binary can find modules/, payload/, VERSION, etc.
    // In dev: set from env if available
    // In production: would be set to the Tauri resource directory
    if let Ok(root) = std::env::var("ENDSTATE_ROOT") {
        cmd.env("ENDSTATE_ROOT", &root);
    }

    cmd
}
```

**Remove** these functions entirely — they're PowerShell-specific:
- `build_bundled_engine_command()`
- `strip_extended_path_prefix()`

**Keep** `endstate_exec()` unchanged — it delegates to `build_engine_command()`.

### 3. src-tauri/src/engine_adapter.rs — Update engine_run

Check how `engine_run()` builds its command. It likely calls `build_engine_command()` too. Verify it still works with the simplified version. The key thing: it must set `ENDSTATE_ROOT` and pass `--events jsonl` for streaming.

Also check if there's a `get_bundled_engine_path` Tauri command that resolves the bundled .ps1 path — if so, update it to resolve the Go sidecar binary path instead, or remove it if the frontend no longer needs it.

### 4. src/lib/engine-exec.ts — Simplify buildEngineCommand

The frontend's `buildEngineCommand()` has 3 modes. Simplify:

- **path mode** (dev): `exe = 'endstate'`, args passed directly — already works, no change needed
- **bundled mode** (production): should use the sidecar binary path. The current code tries to resolve via `invoke('get_bundled_engine_path')` which returns a .ps1 path. Either:
  - Update the Rust command to return the Go sidecar path instead, OR
  - Use Tauri v2's sidecar API from the frontend (`Command.sidecar()`)
- **script mode**: keep for backward compatibility but it should be considered legacy. The Go binary makes script mode unnecessary.

The simplest approach: make bundled mode fall through to path mode (both use `exe = 'endstate'`). In production, the sidecar binary is on PATH automatically. Check Tauri v2 sidecar behavior — sidecars may be resolved differently.

### 5. src/settings.ts — Update defaults

Change the default `engineMode` from `'bundled'` to `'path'` for development simplicity. Or keep `'bundled'` if the Tauri sidecar handles resolution.

Consider whether `engineScriptPath` and `engineMode: 'script'` should be kept, deprecated, or removed. For now, keep them but add a comment that script mode is legacy.

### 6. src/components/ — Settings UI (optional)

The Settings page has "Use endstate from PATH" and "Use endstate script path" radio buttons. Consider:
- Rename "Use endstate script path" to something less PowerShell-specific, or
- Keep as-is for backward compatibility with users who have custom engine builds

### 7. Pre-build: Build Go binary

The Go binary needs to be built before `tauri build`. Add to `package.json` scripts:

```json
{
  "scripts": {
    "build:engine": "cd ../endstate/go-engine && go build -o endstate.exe ./cmd/endstate",
    "prebuild": "npm run build:engine"
  }
}
```

Or document it as a manual step. Don't over-automate if it adds complexity.

### 8. package.json predev hook

The current `predev` script runs PowerShell bootstrap. Update it to build/copy the Go binary instead:

Check what `predev` currently does and update accordingly. It should ensure the Go binary is available for dev mode.

## What NOT to Change

- Do NOT modify any Go engine files (../endstate/go-engine/)
- Do NOT change the JSON contract surface — the GUI already works with the Go engine's output
- Do NOT remove the `endstate_exec` Tauri command — the frontend calls it for non-streaming commands
- Do NOT remove the `engine_run` Tauri command — the frontend calls it for streaming commands
- Keep the streaming adapter working — it reads stdout/stderr and emits events

## Testing

After all changes:

1. `npm run tauri dev` — should start without errors
2. Settings page → engine mode should work
3. Reload Engine → should show capabilities from Go binary (schemaVersion 1.0, cliVersion 1.3.0)
4. Profile list → should discover profiles
5. Select profile → Preview → should show dry-run results
6. Capture flow → should produce 83 apps + 18 settings (confirms modules/ are found)
7. Console should NOT show any PowerShell-related errors

## Acceptance Criteria

1. `npm run tauri dev` starts without errors
2. GUI communicates with Go engine for all commands
3. `build_engine_command()` in cmd_impl.rs has no PowerShell wrapping code
4. `build_bundled_engine_command()` and `strip_extended_path_prefix()` removed
5. Old PowerShell resource entries removed from tauri.conf.json
6. Go binary referenced as sidecar or resolved from PATH
7. ENDSTATE_ROOT set correctly so modules/ and payload/ are found by Go binary
8. Capture produces zip with config modules (not bare manifest)
9. No PowerShell-related code in the spawn path
10. `cargo test` passes in src-tauri/
```
