# http-bridge Specification

## Purpose
TBD - created by archiving change tidewave-http-bridge. Update Purpose after archive.
## Requirements
### Requirement: Dev-only HTTP bridge for Tidewave
When running in debug mode with TIDEWAVE_ENABLED=1, the Tauri backend SHALL start an HTTP server on port 9876 that mirrors Tauri IPC commands, allowing the frontend to route calls through HTTP/SSE instead of Tauri IPC.

#### Scenario: HTTP bridge starts in dev mode with Tidewave enabled
- **GIVEN** the app is built in debug mode AND TIDEWAVE_ENABLED=1 is set
- **WHEN** the Tauri app starts
- **THEN** an HTTP server starts on port 9876 and logs "Tidewave HTTP bridge listening on http://127.0.0.1:9876"

#### Scenario: HTTP bridge does NOT start in release mode
- **GIVEN** the app is built in release mode
- **WHEN** the Tauri app starts
- **THEN** no HTTP server is started on port 9876

#### Scenario: HTTP bridge does NOT start without env var
- **GIVEN** the app is built in debug mode AND TIDEWAVE_ENABLED is not set
- **WHEN** the Tauri app starts
- **THEN** no HTTP server is started on port 9876

#### Scenario: Frontend routes invoke through HTTP in Tidewave mode
- **GIVEN** the frontend is running in web mode (not Tauri runtime) AND VITE_TIDEWAVE_ENABLED=1 is set
- **WHEN** safeInvoke("engine_is_running", {}) is called
- **THEN** the call is routed to POST http://127.0.0.1:9876/api/invoke with body {"cmd": "engine_is_running", "args": {}} and the response is deserialized as the return value

#### Scenario: Frontend receives events via SSE in Tidewave mode
- **GIVEN** the frontend is running in Tidewave mode
- **WHEN** safeListen("endstate://event", handler) is called
- **THEN** an EventSource connects to http://127.0.0.1:9876/events and engine events are delivered to the handler

#### Scenario: Normal Tauri mode is unaffected
- **GIVEN** the frontend is running inside the Tauri webview
- **WHEN** safeInvoke or safeListen is called
- **THEN** calls route through Tauri IPC as before (no HTTP)

