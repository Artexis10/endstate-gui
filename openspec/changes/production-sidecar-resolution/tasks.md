## 1. Rust Backend — Sidecar Resolution

- [x] 1.1 Extract sidecar resolution + ENDSTATE_ROOT logic from the `__bundled__` branch in `engine_adapter.rs` into a shared helper function that returns a configured `std::process::Command`. The helper scans for `endstate-x86_64-pc-windows-msvc.exe` first, then `endstate.exe`, and sets `ENDSTATE_ROOT` to `resource_dir/engine/`.
- [x] 1.2 Update `run_engine()` in `engine_adapter.rs` to call the shared helper when `exe == "__bundled__"`.
- [x] 1.3 Update `endstate_exec()` in `cmd_impl.rs` to also handle `exe == "__bundled__"` using the shared helper, so non-streaming calls (capabilities) also resolve the sidecar.
- [x] 1.4 Delete `resolve_bundled_engine_path()` and the `get_bundled_engine_path` Tauri command from `lib.rs`. Remove the command from the `generate_handler!` macro invocation.

## 2. Frontend — Bundled Mode Simplification

- [x] 2.1 In `engine-exec.ts` `buildEngineCommand()`: when `engineMode === 'bundled'`, return `{ exe: '__bundled__', args: commandArgs }`. Remove the `invoke('get_bundled_engine_path')` call and the silent catch/PATH-fallback block.
- [x] 2.2 In `App.tsx` settings radio group (~line 2774): add `'bundled'` as a radio option labeled "Bundled (recommended)". Update the `onValueChange` type to include `'bundled'`. Label `'path'` as "System PATH (development)" and `'script'` as "Script (legacy)".

## 3. Verification

- [x] 3.1 Run `cargo test` in `src-tauri/` — all Rust tests pass.
- [x] 3.2 Run `npm run test` — all frontend tests pass.
- [x] 3.3 Run `npm run build` — TypeScript compiles and Vite build succeeds.
- [x] 3.4 Run `npm run openspec:validate` — specs are valid.
