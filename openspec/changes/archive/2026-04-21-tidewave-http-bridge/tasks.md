# Tasks

> **Retroactive reconciliation:** this change's implementation shipped on `main` but `tasks.md` was never flipped. All items below verified against the current tree (see PR description).

## 1. Rust: Add dependencies
- [x] 1.1 Add axum, tower-http (cors), tokio-stream to Cargo.toml (dev-profile or always — they compile out behind cfg)

## 2. Rust: Event broadcaster
- [x] 2.1 Create `src-tauri/src/event_broadcast.rs` with tokio::sync::broadcast channel
- [x] 2.2 Create `emit_event()` wrapper that calls app.emit() AND pushes to broadcast channel
- [x] 2.3 Update engine_adapter.rs to use emit_event() instead of direct app.emit()
- [x] 2.4 Update run_endstate_streaming in lib.rs to use emit_event() for stdout/stderr/exit events

## 3. Rust: HTTP server
- [x] 3.1 Create `src-tauri/src/dev_server.rs` with axum HTTP server
- [x] 3.2 Implement POST /api/invoke endpoint with command dispatch
- [x] 3.3 Implement GET /events SSE endpoint consuming broadcast channel
- [x] 3.4 Add CORS middleware for http://127.0.0.1:1420
- [x] 3.5 Gate behind #[cfg(debug_assertions)] + TIDEWAVE_ENABLED env check

## 4. Rust: Integration
- [x] 4.1 Register dev_server module in lib.rs
- [x] 4.2 Start HTTP server in Tauri setup hook (async task)
- [x] 4.3 Pass SharedRunState and broadcast sender to HTTP server

## 5. Frontend: HTTP bridge client
- [x] 5.1 Create `src/lib/http-bridge.ts` with httpInvoke() and httpListen()
- [x] 5.2 Handle SSE connection lifecycle (connect, reconnect, cleanup)

## 6. Frontend: Routing integration
- [x] 6.1 Add isTidewaveMode() detection to tauri-bridge.ts
- [x] 6.2 Route safeInvoke through httpInvoke when in Tidewave mode
- [x] 6.3 Route safeListen through httpListen when in Tidewave mode

## 7. Vite config
- [x] 7.1 Ensure VITE_TIDEWAVE_ENABLED is exposed to frontend

## 8. Verification
- [x] 8.1 `cd src-tauri && cargo test` passes
- [x] 8.2 `npm run test` passes
- [x] 8.3 Manual: `npm run tauri dev` works normally (no regression)
- [x] 8.4 Manual: Open http://127.0.0.1:1420 in browser with bridge running
