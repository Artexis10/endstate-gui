# Tasks

> **Retroactive reconciliation:** this change's implementation shipped on `main` but `tasks.md` was never flipped. All items below verified against the current tree (see PR description).

## 1. Tauri Config — Sidecar + Resources

- [x] 1.1 Remove all 8 PowerShell resource directory entries from `bundle.resources` in `tauri.conf.json`
- [x] 1.2 Add `externalBin` entry for Go binary (`../endstate/go-engine/endstate`)
- [x] 1.3 Add reduced `bundle.resources` for data directories (modules/, payload/, VERSION, SCHEMA_VERSION)
- [x] 1.4 Ensure Go binary is named with platform triple (`endstate-x86_64-pc-windows-msvc.exe`) or create copy/symlink

## 2. Rust Backend — Simplify cmd_impl.rs

- [x] 2.1 Replace `build_engine_command()` with simplified version (Command::new(exe), no CMD /C, no PowerShell wrapping, pass through ENDSTATE_ROOT)
- [x] 2.2 Remove `build_bundled_engine_command()` function
- [x] 2.3 Remove `strip_extended_path_prefix()` function
- [x] 2.4 Update or remove any references to ENDSTATE_ALLOW_DIRECT
- [x] 2.5 Update cmd_impl.rs unit tests (if any) for simplified command builder

## 3. Rust Backend — Update engine_adapter.rs

- [x] 3.1 Update `run_engine()` bundled path (`exe == "__bundled__"`) to resolve Go sidecar binary instead of .ps1 entrypoint
- [x] 3.2 Set ENDSTATE_ROOT to Tauri resource directory's engine/ subdirectory for bundled mode
- [x] 3.3 Remove PowerShell-specific bundled engine resolution code (endstate.ps1 path, build_bundled_engine_command call)

## 4. Rust Backend — Update lib.rs

- [x] 4.1 Update or remove `get_bundled_engine_path` Tauri command to return sidecar binary path instead of .ps1 path

## 5. Frontend — Simplify engine-exec.ts

- [x] 5.1 Update `buildEngineCommand()` bundled mode to use `exe='endstate'` with direct args (same as path mode) instead of PowerShell wrapping via `get_bundled_engine_path`
- [x] 5.2 Update settings.ts default `engineScriptPath` comment to note script mode is legacy

## 6. Build & Dev Hooks

- [x] 6.1 Update `predev` npm script to work with Go binary instead of PowerShell bootstrap
- [x] 6.2 Document Go binary build step (or add `build:engine` npm script)

## 7. Cleanup & Docs

- [x] 7.1 Update CLAUDE.md critical landmines and architecture sections to reflect Go engine (remove PowerShell references from cmd_impl.rs description)
- [x] 7.2 Run `cargo test` in src-tauri/ and fix any failures from removed functions
- [x] 7.3 Run `npx tsc --noEmit` and fix any TypeScript errors
- [x] 7.4 Run `npx vitest run` and fix any unit test failures
