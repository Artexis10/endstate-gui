## 1. Rust Backend — Sidecar Resolution & Window Suppression

- [x] 1.1 In `lib.rs` `run_endstate_streaming()`: add `if exe == "__bundled__"` branch that calls `engine_adapter::build_bundled_command()`, matching the pattern in `endstate_exec()` and `run_engine()`. This ensures ENDSTATE_ROOT is set for streaming operations (capture, apply, verify).
- [x] 1.2 Verify `build_bundled_command()` in `engine_adapter.rs` correctly handles target-triple sidecar filenames: tries `endstate-x86_64-pc-windows-msvc.exe` first, then `endstate.exe`.
- [x] 1.3 Delete `resolve_bundled_engine_path()` from `lib.rs` and remove its Tauri command registration from `generate_handler!`. (Already removed in prior work.)
- [x] 1.4 Add `CREATE_NO_WINDOW` to `build_bundled_command()` in `engine_adapter.rs`.
- [x] 1.5 Add `CREATE_NO_WINDOW` to `build_engine_command()` in `cmd_impl.rs` using the same pattern.
- [x] 1.6 Run `cargo test` in `src-tauri/` — all 25 Rust tests pass.

## 2. Frontend & Build Hygiene

- [x] 2.1 In `streaming-runner.ts` (~line 75-78): when `engineMode === 'bundled'`, set `exe = '__bundled__'` instead of `'endstate'`.
- [x] 2.2 In `engine-exec.ts` `buildEngineCommand()`: verified bundled branch already returns `{ exe: '__bundled__', args }` with no silent catch/fallback. No changes needed.
- [x] 2.3 Create `.env.production` in project root with `VITE_DEV_BYPASS_LICENSE=0`.
- [x] 2.4 In `App.tsx` settings radio group: verified all three options already present — "Bundled (recommended)", "System PATH (development)", "Script (legacy)". Default engineMode is `bundled`. No changes needed.
- [x] 2.5 Run `npm run test` — all 880 tests pass.
- [x] 2.6 Run `npm run build` — TypeScript compiles and Vite build succeeds.

## 3. Verification

- [x] 3.1 Run `npm run openspec:validate` — 23 passed, 0 failed.
