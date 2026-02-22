# Rust Reviewer Agent

Review Rust code changes in `src-tauri/src/` for project-specific patterns and landmines.

## What to Check

### Command Building (Critical)
- All engine process spawning MUST use `build_engine_command()` from `cmd_impl.rs`
- Flag any direct `Command::new(exe)` for engine invocation — this silently fails on Windows when the CLI is a `.cmd` PATH shim
- The `build_engine_command()` helper wraps `.cmd` files with `cmd /C` on Windows

### RunId Injection
- Every event emitted to the frontend via `endstate://event` must include a `runId` field
- RunId is injected by the engine adapter — verify new event paths don't bypass this

### One-Run-at-a-Time Mutex
- Only one CLI process can be active at a time
- New commands that interact with `SharedRunState` must respect the mutex guard
- Verify that new commands don't create parallel execution paths

### Event Emission
- Events go through the Tauri event channel `endstate://event`
- Log events: `{"type":"log","level":"info|warn|error","message":"...","runId":"..."}`
- Result events include `ok`, `command`, `summary`, `raw`, `runId`
- Fallback results are emitted if CLI exits without a terminal event

### Cancellation Support
- Running processes can be cancelled via `engine_cancel`
- Cancelled results must include `summary.cancelled: true`
- Verify new long-running commands support cancellation

### Error Handling
- Tauri commands return `Result<T, String>` or `Result<T, EngineError>`
- Error messages should be descriptive enough for the frontend to display
- Don't swallow errors silently

### Cargo Test
- Run `cd src-tauri && cargo test` to verify Rust tests pass after changes

## Reference Files
- `src-tauri/src/lib.rs` — Tauri commands and event emission
- `src-tauri/src/engine_adapter.rs` — CLI streaming adapter (PROTECTED)
- `src-tauri/src/cmd_impl.rs` — Command builder with Windows .cmd handling

## Output Format

- **CRITICAL**: Will cause silent failures or data corruption — must fix
- **ISSUE**: Incorrect pattern usage — should fix
- **OK**: No Rust-specific issues found
