# http-bridge Specification

## Purpose
The browser bridge exposes a dev-only HTTP server on port 9876 that mirrors Tauri IPC commands. It lets a regular browser tab pointed at the Vite dev server drive the GUI against the real engine, enabling browser-based development and Playwright automation outside the Tauri webview.

## Requirements

### Requirement: Authenticated standalone bridge for browser access

The development launcher SHALL start a standalone loopback HTTP bridge that mirrors Tauri IPC commands for an authenticated browser session. Packaged Tauri applications SHALL use native IPC and SHALL NOT start this listener.

#### Scenario: Launcher starts the standalone bridge

- **WHEN** the development launcher creates an authenticated session
- **THEN** it starts the bridge on `127.0.0.1:9876` and the frontend on `127.0.0.1:1420`
- **AND** it publishes a private bootstrap after both listeners are ready

#### Scenario: Tauri mode does not start an HTTP listener

- **WHEN** a Tauri application starts in debug or release mode
- **THEN** it uses native IPC without starting the standalone HTTP bridge

#### Scenario: Frontend invokes an authenticated command

- **GIVEN** a browser has consumed the private session bootstrap
- **WHEN** it invokes a command in browser-bridge mode
- **THEN** it sends an authenticated request to `/api/invoke`
- **AND** command arguments and response envelopes retain their existing shapes

#### Scenario: Frontend receives authenticated events

- **GIVEN** a browser has consumed the private session bootstrap
- **WHEN** it subscribes to engine events
- **THEN** it authenticates the `/events` stream
- **AND** event payloads, reconnection, and listener disposal retain their existing behavior

### Requirement: Every privileged bridge request requires session authority

The bridge SHALL authenticate command and event requests before processing their bodies. It SHALL accept only its configured loopback authority and frontend origin. Authenticated scripted clients SHALL be able to omit an origin.

#### Scenario: Missing or incorrect credentials

- **WHEN** a command or event request lacks valid session credentials
- **THEN** the bridge returns `401` without invoking an owner operation or emitting an event

#### Scenario: Untrusted origin or authority

- **WHEN** a request has an unexpected authority, conflicting authorities, or an unexpected origin including `null`
- **THEN** the bridge refuses it before invoking an owner operation
- **AND** forwarded headers do not grant authority

#### Scenario: Authenticated scripted client

- **WHEN** a request has valid session credentials and the expected authority without an origin
- **THEN** the bridge processes the existing command or event request

#### Scenario: Browser preflight

- **WHEN** the configured frontend requests an allowed method and authorization header through CORS preflight
- **THEN** the bridge permits preflight without granting command or event access

### Requirement: Bootstrap credentials remain private to the launch owner

Each launch SHALL create fresh credentials in private local files outside served directories. Other ordinary local users and unauthenticated HTTP clients SHALL NOT obtain them. Credentials SHALL NOT appear in command arguments, logs, public assets, or query strings.

#### Scenario: Browser consumes the private bootstrap

- **WHEN** the owner opens the local bootstrap file
- **THEN** the browser receives session authority without a public credential endpoint
- **AND** it removes the credential fragment immediately and retains authority only for that tab

#### Scenario: Bootstrap files are inaccessible to other users

- **WHEN** the launcher creates bootstrap files on a supported platform
- **THEN** it establishes and verifies owner-only access before writing credentials
- **AND** the frontend server cannot serve the files

#### Scenario: Bare browser tab or stale credentials

- **WHEN** a browser lacks current session authority
- **THEN** bridge calls give a clear private-bootstrap error
- **AND** event subscriptions stop retrying authentication failures

#### Scenario: Tidewave HTTP remains disabled

- **WHEN** browser-bridge mode starts, including with a Tidewave enable flag present
- **THEN** the development server does not expose Tidewave HTTP execution capabilities

### Requirement: The launcher owns listener lifetime

The launcher SHALL refuse occupied listeners and unsafe bootstrap storage. Its loss SHALL stop the privileged listener. Restarting SHALL create fresh credentials without reusing another process's listener.

#### Scenario: Rust receives launch authority

- **WHEN** the launcher starts its Rust child
- **THEN** it sends one newline-terminated session JSON frame through the child's private stdin pipe
- **AND** Rust validates the complete frame before creating a runtime or binding a listener
- **AND** the frame contains at most 4096 JSON bytes and one terminating newline

#### Scenario: Missing or invalid launch frame

- **WHEN** the private stdin frame is missing, malformed, incomplete, oversized, or violates the session protocol
- **THEN** Rust fails startup without binding a listener
- **AND** a descriptor path in the environment does not grant launch authority

#### Scenario: Listener or storage cannot be owned safely

- **WHEN** either required port is occupied or private bootstrap storage cannot be verified
- **THEN** startup fails without publishing usable session credentials

#### Scenario: Readiness cannot disclose authority to an existing listener

- **WHEN** the launcher checks bridge readiness
- **THEN** it confirms its child owns the listener through the private bind handshake
- **AND** it sends no HTTP readiness request or credentials to an existing listener

#### Scenario: Frontend configuration reload

- **WHEN** the development server reloads its configuration
- **THEN** the launcher retains ownership of the frontend listener while bridge credentials remain valid

#### Scenario: Launcher terminates or restarts

- **WHEN** the launcher exits, including abnormal termination
- **THEN** EOF on the same private stdin pipe stops its privileged listener and existing event streams
- **AND** a later launch rejects the previous credentials
