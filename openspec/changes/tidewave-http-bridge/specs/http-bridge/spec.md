# Tidewave HTTP Bridge Spec

## Scenario: HTTP bridge starts in dev mode with Tidewave enabled
Given the app is built in debug mode
And TIDEWAVE_ENABLED=1 is set
When the Tauri app starts
Then an HTTP server starts on port 9876
And it logs "Tidewave HTTP bridge listening on http://127.0.0.1:9876"

## Scenario: HTTP bridge does NOT start in release mode
Given the app is built in release mode
When the Tauri app starts
Then no HTTP server is started on port 9876

## Scenario: HTTP bridge does NOT start without env var
Given the app is built in debug mode
And TIDEWAVE_ENABLED is not set
When the Tauri app starts
Then no HTTP server is started on port 9876

## Scenario: Frontend routes invoke through HTTP in Tidewave mode
Given the frontend is running in web mode (not Tauri runtime)
And VITE_TIDEWAVE_ENABLED=1 is set
When safeInvoke("engine_is_running", {}) is called
Then the call is routed to POST http://127.0.0.1:9876/api/invoke
With body {"cmd": "engine_is_running", "args": {}}
And the response is deserialized as the return value

## Scenario: Frontend receives events via SSE in Tidewave mode
Given the frontend is running in Tidewave mode
When safeListen("endstate://event", handler) is called
Then an EventSource connects to http://127.0.0.1:9876/events
And engine events are delivered to the handler

## Scenario: Normal Tauri mode is unaffected
Given the frontend is running inside the Tauri webview
When safeInvoke or safeListen is called
Then calls route through Tauri IPC as before (no HTTP)
