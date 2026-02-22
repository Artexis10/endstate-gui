---
name: tauri-command
description: Scaffold a new Tauri command across Rust backend and TypeScript frontend with proper patterns.
---

Scaffold a new Tauri command with both Rust and TypeScript sides.

**Input**: Command name and purpose. Example: `/tauri-command check_update "Check if CLI update is available"`

**Steps**

1. **Add the Rust command** in `src-tauri/src/lib.rs`:
   - Add a `#[tauri::command]` function following existing patterns
   - Use proper Tauri state management (`State<'_, SharedRunState>` if run-related)
   - Return `Result<T, String>` for fallible commands
   - Register in the `invoke_handler` in `run()` function

2. **If the command spawns a CLI process**:
   - MUST use `build_engine_command()` from `cmd_impl.rs` — never bare `Command::new()`
   - This handles Windows `.cmd` PATH shim wrapping (`cmd /C` for `.cmd` files)
   - Respect the one-run-at-a-time mutex guard via `SharedRunState`

3. **Add TypeScript bridge function** in the appropriate location:
   - For engine operations: `src/engine-bridge.ts`
   - For utility operations: a new or existing file in `src/lib/`
   - Use `import { invoke } from '@tauri-apps/api/core'`
   - Type the return value to match the Rust response

4. **Add capability permission** if needed in `src-tauri/capabilities/`

5. **Add the Tauri bridge mock** in `src/test/tauri-bridge-mock.ts` for unit testing

**Rust Pattern**

```rust
#[tauri::command]
async fn my_command(arg: String) -> Result<MyResponse, String> {
    // For CLI execution, ALWAYS use build_engine_command():
    // let mut cmd = cmd_impl::build_engine_command(&exe, &args);
    Ok(MyResponse { /* ... */ })
}
```

**TypeScript Pattern**

```typescript
import { invoke } from '@tauri-apps/api/core';

export async function myCommand(arg: string): Promise<MyResponse> {
  return invoke<MyResponse>('my_command', { arg });
}
```

**Critical Landmine**
Windows `.cmd` PATH resolution: Rust's `std::process::Command` only resolves `.exe` files. The `endstate.cmd` shim requires `cmd /C` wrapping. All spawn sites MUST use `build_engine_command()` from `cmd_impl.rs`. Direct `Command::new(exe)` will silently fail when the CLI is a `.cmd` shim on PATH.

**Protected Files Warning**
`src/engine-bridge.ts` and `src-tauri/src/engine_adapter.rs` are protected files. Modifications require explicit user instruction. If the new command needs changes there, flag this before proceeding.
