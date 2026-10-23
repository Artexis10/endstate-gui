# Design

## Context

See the proposal for the problem and scope. The bridge already runs outside Tauri and shares engine operations through `engine-core`.
Native EventSource cannot attach an authorization header. The locked `eventsource` 3.0.7 package supports browsers, custom fetch, and status-bearing errors.
The launcher and real-engine tests currently start public listeners independently. Vite's normal configuration restart releases its listener.
The launcher uses Vite 6.4.4 to close upstream path-serving bypasses that defeat private bootstrap storage.
See [the upstream file-serving advisory](https://github.com/advisories/GHSA-rq7h-c2jc-7f22).

## Goals / Non-Goals

Authenticate ordinary local callers and browser origins while retaining the existing command and event protocol.
Preserve the packaged application's native IPC boundary. Same-user arbitrary code and administrator access remain outside this boundary.

## Decisions

### One launcher owns the session

The launcher creates a fresh 32-byte bearer and a descriptor containing version, frontend origin, bridge URL, and bearer.
It creates a private runtime directory outside served trees, then writes the descriptor and a local bootstrap HTML file.
POSIX directories use mode 0700 and files use mode 0600, verified through filesystem metadata.
Windows creates the directory atomically with a protected DACL, or beneath a verified private parent, before any credential write.
Verification reads the owner SID, protection status, and allowed trustees.
ACL structure verification alone does not prove privacy. Use SID objects and native filesystem security APIs without elevation.

The launcher passes the descriptor path to Rust. Rust reports successful binding through its inherited control pipe before authenticated HTTP readiness runs.
The bridge stops when that pipe closes. Port conflicts fail startup; no process reuses a public listener.
Vite runs in middleware mode behind one launcher-owned HTTP listener, which remains bound across configuration restarts.

### Private bootstrap supplies browser authority

The owner opens a local bootstrap file whose path contains no credential.
The file redirects to the configured frontend with a fragment that the application immediately removes and saves in tab-scoped session storage.
Automation reads the same protected descriptor inside its own process and initializes browser authority before application modules run.
Readiness helpers, real-engine tests, livewire instructions, and the demo recorder use this contract.
Real-engine traces remain disabled because authenticated headers and navigation fragments can otherwise enter uploaded artifacts.

### Existing transport mechanisms enforce the boundary

Axum middleware validates the exact authority and any supplied origin before CORS preflight.
The maintained CORS layer wraps bearer authentication so the accepted frontend can observe authentication failures.
Authentication runs before JSON extraction. Duplicate or conflicting authority, origin, and authorization values fail validation.
Scripted clients may omit Origin with a valid bearer. Forwarded headers do not authorize a caller.
The browser uses the existing locked EventSource client through a direct dependency and supplies Authorization through custom fetch.
Authentication failures stop reconnection; ordinary connection failures retain existing retry behavior.
Tidewave HTTP stays disabled whenever browser-bridge mode runs, regardless of enable flags.

### Reuse and control costs

Use native ACL APIs, Axum, tower-http, Vite's JavaScript API, and EventSource instead of a custom authentication framework or SSE parser.
Public tokens, unauthenticated proxies, and origin checks alone cannot authenticate a local non-browser caller.
Host-wide cookies cross loopback ports, so the bridge uses request headers.
Missing authority or unsafe storage prevents owner-operation exposure; a false refusal costs the developer a relaunch or supported storage.
Exclusive listeners and private readiness prevent credential disclosure; occupied ports require the developer to resolve the conflict.
Disabling traces reduces test diagnostics but prevents reusable credentials from entering artifacts.

## Risks / Trade-offs

- Windows ACL handling requires platform verification before claiming protection on Windows.
- Existing bare browser tabs must use the bootstrap once per launch; reloads retain tab authority.
- The new public frontend listener must never expose the private runtime directory through filesystem serving.
- Tests must exercise the bridge feature explicitly because the default Rust feature set excludes HTTP.

## Migration Plan

1. Update launcher, server, clients, automation, and instructions together; all consumers use the descriptor.
2. Verify real HTTP, browser startup, private storage, and process lifetime; preserve existing command results.
3. Deliver the reviewed source batch through normal CI; packaged Tauri behavior remains native.
