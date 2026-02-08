# Tasks

## 1. Rust: Add dependencies
- [ ] 1.1 Add axum, tower-http (cors), tokio-stream to Cargo.toml (dev-profile or always — they compile out behind cfg)

## 2. Rust: Event broadcaster
- [ ] 2.1 Create `src-tauri/src/event_broadcast.rs` with tokio::sync::broadcast channel
- [ ] 2.2 Create `emit_event()` wrapper that calls app.emit() AND pushes to broadcast channel
- [ ] 2.3 Update engine_adapter.rs to use emit_event() instead of direct app.emit()
- [ ] 2.4 Update run_endstate_streaming in lib.rs to use emit_event() for stdout/stderr/exit events

## 3. Rust: HTTP server
- [ ] 3.1 Create `src-tauri/src/dev_server.rs` with axum HTTP server
- [ ] 3.2 Implement POST /api/invoke endpoint with command dispatch
- [ ] 3.3 Implement GET /events SSE endpoint consuming broadcast channel
- [ ] 3.4 Add CORS middleware for http://127.0.0.1:1420
- [ ] 3.5 Gate behind #[cfg(debug_assertions)] + TIDEWAVE_ENABLED env check

## 4. Rust: Integration
- [ ] 4.1 Register dev_server module in lib.rs
- [ ] 4.2 Start HTTP server in Tauri setup hook (async task)
- [ ] 4.3 Pass SharedRunState and broadcast sender to HTTP server

## 5. Frontend: HTTP bridge client
- [ ] 5.1 Create `src/lib/http-bridge.ts` with httpInvoke() and httpListen()
- [ ] 5.2 Handle SSE connection lifecycle (connect, reconnect, cleanup)

## 6. Frontend: Routing integration
- [ ] 6.1 Add isTidewaveMode() detection to tauri-bridge.ts
- [ ] 6.2 Route safeInvoke through httpInvoke when in Tidewave mode
- [ ] 6.3 Route safeListen through httpListen when in Tidewave mode

## 7. Vite config
- [ ] 7.1 Ensure VITE_TIDEWAVE_ENABLED is exposed to frontend

## 8. Verification
- [ ] 8.1 `cd src-tauri && cargo test` passes
- [ ] 8.2 `npm run test` passes
- [ ] 8.3 Manual: `npm run tauri dev` works normally (no regression)
- [ ] 8.4 Manual: Open http://127.0.0.1:1420 in browser with bridge running
