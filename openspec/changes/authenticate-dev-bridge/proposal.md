# Proposal

## Why

The development bridge exposes owner-level command and file operations without caller authentication. Loopback binding and CORS do not authenticate another local user.

## What Changes

- Require a fresh launch credential for command calls and event streams.
- Bootstrap browsers and automation through private local files outside the development server's served directories.
- Bind listener lifetime to its launcher and reject occupied ports.
- Disable Tidewave HTTP whenever browser-bridge mode runs.
- **BREAKING**: unauthenticated browser tabs and scripted clients must use the private bootstrap.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `http-bridge`: authenticated standalone development transport, private bootstrap, and launcher ownership.

## Impact

The change affects the launcher, Rust HTTP middleware, browser transport, development configuration, and real-engine automation.
It preserves command envelopes, event payloads, and packaged Tauri IPC.
It adds a maintained EventSource client for authenticated streaming and platform-specific checks for private bootstrap files.
