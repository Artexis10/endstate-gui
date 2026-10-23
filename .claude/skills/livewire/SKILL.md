---
name: livewire
description: Drive the real GUI against the real engine through the authenticated standalone development bridge.
---

The standalone bridge connects Chromium to the real engine without loading Tauri.
Use it to verify GUI wiring, inspect real command envelopes, and debug browser interactions.
Packaged Tauri applications continue to use native IPC.

## Prepare and launch

1. Select the pinned released engine with its verified checksum, or build an isolated source copy.
2. Set `ENDSTATE_ENGINE_PATH` and `ENDSTATE_ROOT` to that engine and its matching module catalog.
3. Check who owns ports 1420 and 9876; stop only a process that this session owns.
4. Run `SKIP_ENGINE_BUILD=1 npm run dev:bridge`; expect the private bootstrap and descriptor paths.
5. Open the printed local `open-browser.html` file in isolated Chromium; expect the GUI with an empty URL fragment.

The launcher owns both listeners. An occupied port fails startup; never reuse another process's listener.
It gives Rust its session through a private stdin pipe; ENDSTATE_BRIDGE_SESSION only supplies authority to scripted clients.
It disables Tidewave HTTP in bridge mode even when enable flags are present.
Vite reloads retain the frontend listener. Launcher loss closes the privileged listener.
Each launch creates a fresh credential. Reopen its private bootstrap after a relaunch.
Reloads retain authority in that tab's session storage.

The runtime directory is outside the served repository, with verified owner-only permissions.
Treat its contents as credentials. Do not print the descriptor, copy it into the repository, or attach it to an artifact.
Never put the bearer in command arguments, logs, HTTP query strings, public environment variables, or traces.
Do not export authenticated network headers or browser storage through DevTools.
Real-engine Playwright traces stay disabled.

## Verify the workflow

1. Set `ENDSTATE_BRIDGE_SESSION` to the printed descriptor path; expect scripted clients to use this launch.
2. Run `node scripts/bridge-invoke.cjs engine_is_running`; expect the existing command response envelope.
3. Run `node scripts/bridge-invoke.cjs endstate_exec '{"exe":"__bundled__","args":["capabilities","--json"]}'`; expect a real engine envelope.
4. Inspect the GUI through Chrome DevTools; expect its requests to use the standalone bridge.
5. Exercise the requested safe workflow; compare its final state with the engine response.
6. Reload the tab; expect authenticated requests to continue without a credential fragment.
7. Stop the owned launcher; expect both listeners to close.

Use the supported `codex-browser` helper when browser tools are absent.
It opens an isolated Chrome profile. Never attach to personal Chrome.
Keep screenshots and other test output under the session's private temporary root.
Do not run host installation, restore, or apply operations without their own authorization.

## Report

Name the tested workflow, the engine version or source revision, and the observed result.
State unverified environments and any failing interaction. Do not include credentials or private runtime files.
