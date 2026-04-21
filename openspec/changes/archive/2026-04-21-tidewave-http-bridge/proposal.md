# Tidewave HTTP Bridge

## Problem
Tidewave inspects a browser tab (web runtime). Tauri IPC only exists inside the Tauri webview.
Engine-dependent UI states cannot be visually debugged with Tidewave.

## Solution
Dev-only HTTP server (port 9876) in the Rust backend that mirrors Tauri commands.
Frontend detects Tidewave mode and routes invoke/listen through HTTP/SSE instead of IPC.

## Scope
- Rust: HTTP server with command dispatch + SSE event broadcasting
- Frontend: HTTP bridge adapter in tauri-bridge.ts
- Dev-only, gated behind debug_assertions + TIDEWAVE_ENABLED=1
