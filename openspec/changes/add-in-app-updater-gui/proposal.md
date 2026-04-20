## Why

Customers have no in-app update path today; every release requires them to manually download and reinstall an NSIS/MSI bundle from a GitHub Release. This is the first of three sequential changes to close that gap. This change captures the GUI-side integration that has already shipped on `main` — retroactively documenting what was built so the capability is covered by an OpenSpec requirement trail before the remaining release-workflow and manifest-hosting pieces land.

## What Changes

- Introduce a new `in-app-update` capability covering end-to-end update UX visible to the user: automatic check on launch, manual "Check for updates" action in Settings, progress feedback, one-click install with restart, and graceful failure modes.
- Wire in the Tauri v2 `updater` and `process` plugins (Rust and JS sides) with permissions granted via `capabilities/default.json`.
- Configure the updater endpoint and signing public key in `tauri.conf.json` under `plugins.updater`, with `dialog: false` so the app renders its own branded React toast UX instead of Tauri's built-in modal.
- Add a side-effect `UpdatePrompt` component and shared `runUpdateCheck({ manual })` helper that gate all update behavior on `isTauriRuntime()` and use dynamic imports so the web preview bundle still builds without the plugins.
- Add a "Check for updates" button in the Settings page that reuses the same helper and surfaces success / error states via toasts.
- Add `docs/runbooks/UPDATER_SETUP.md` documenting the one-time interactive keypair generation, private-key custody, GitHub Actions secret names (`TAURI_UPDATER_PRIVATE_KEY`, `TAURI_UPDATER_KEY_PASSWORD`), and the procedure for rotating keys.
- Commit the placeholder `REPLACE_WITH_ACTUAL_PUBLIC_KEY` pubkey; the real key is generated and pasted by an operator following the runbook and is a prerequisite for the first signed release.

## Capabilities

### New Capabilities
- `in-app-update`: Automatic and manual update checking, signed bundle download with progress UX, install-and-restart flow, and Tauri-runtime gating so the capability is a no-op outside the desktop app.

### Modified Capabilities
<!-- None. Release-workflow signing and manifest hosting are the subject of two separate follow-on proposals and must not be implied here. -->

## Impact

- Affected code:
  - `src/components/UpdatePrompt.tsx` (new): auto-check component + `runUpdateCheck` helper
  - `src/App.tsx`: imports `UpdatePrompt` and mounts it once inside `LicenseGate`; adds Settings "Updates" card with manual check button
  - `src-tauri/src/lib.rs`: registers `tauri_plugin_updater` and `tauri_plugin_process` in the `Builder` chain
  - `src-tauri/tauri.conf.json`: new `plugins.updater` block (endpoint, `dialog: false`, placeholder pubkey)
  - `src-tauri/capabilities/default.json`: adds `updater:default`, `process:default`, `process:allow-restart`
- New dependencies:
  - npm: `@tauri-apps/plugin-updater`, `@tauri-apps/plugin-process`
  - Cargo: `tauri-plugin-updater = "2"`, `tauri-plugin-process = "2"`
- New docs: `docs/runbooks/UPDATER_SETUP.md`
- Security surface: the GUI now performs signature-verified bundle replacement on the host. Correctness depends on the ed25519 pubkey in `tauri.conf.json` matching the CI-held private key. Until the real pubkey is pasted, no update can succeed — verification failure is silent by design.
- Out of scope (separate upcoming proposals):
  - Release workflow that signs NSIS/MSI and emits per-release `.sig` files (Prompt 2)
  - Manifest hosting at `https://substratesystems.io/updates/latest.json` via Vercel API route backed by the GitHub Releases API (Prompt 3)
