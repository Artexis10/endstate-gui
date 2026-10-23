# Tasks

## 1. Private session and listener ownership

- [ ] 1.1 Create and verify private POSIX and Windows session storage before credential writes; prove permissions with native metadata checks.
- [x] 1.2 Give the Rust child a private session descriptor and bind handshake; prove occupied ports and launcher loss cannot retain authority.
- [x] 1.3 Keep the frontend listener bound through Vite configuration reloads; prove readiness never sends credentials to another listener.

## 2. Authenticated transport

- [x] 2.1 Enforce authority, origin, and bearer checks before command parsing; exercise accepted and refused invoke and event requests.
- [x] 2.2 Consume private browser bootstrap and authenticate EventSource through maintained custom fetch; verify fragment removal, reload, retry, and disposal.
- [x] 2.3 Disable Tidewave HTTP for browser-bridge mode regardless of enable flags; verify the development server exposes no Tidewave execution route.

## 3. Consumers and delivery proof

- [x] 3.1 Update real-engine request helpers, browser setup, demo recording, and livewire instructions to use the same descriptor; disable credential-bearing traces.
- [x] 3.2 Include bridge-feature Rust tests in CI; run relevant unit, real-engine, and browser checks and verify packaged Tauri excludes the HTTP server.
- [ ] 3.3 Complete independent review, resolve its findings, and record remaining platform limitations with the delivered batch.
