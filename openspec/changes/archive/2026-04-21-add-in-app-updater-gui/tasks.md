> **Retroactive note:** this change documents work that shipped to `main` before the proposal was written. All tasks are marked complete to reflect reality at the time of archive. If any box below is found unchecked during review, treat it as a regression.

## 1. Dependencies & configuration

- [x] 1.1 Add `@tauri-apps/plugin-updater` and `@tauri-apps/plugin-process` to `package.json` dependencies
- [x] 1.2 Add `tauri-plugin-updater = "2"` and `tauri-plugin-process = "2"` to `src-tauri/Cargo.toml`
- [x] 1.3 Add `plugins.updater` block to `src-tauri/tauri.conf.json` with `active: true`, the `https://substratesystems.io/updates/latest.json` endpoint, `dialog: false`, and the placeholder pubkey `REPLACE_WITH_ACTUAL_PUBLIC_KEY`
- [x] 1.4 Grant `updater:default`, `process:default`, and `process:allow-restart` in `src-tauri/capabilities/default.json` for the `main` window

## 2. Rust plugin registration

- [x] 2.1 Register `tauri_plugin_updater::Builder::new().build()` in the `tauri::Builder` chain in `src-tauri/src/lib.rs`
- [x] 2.2 Register `tauri_plugin_process::init()` in the same chain
- [x] 2.3 Verify `cargo check` passes cleanly (no new warnings or errors introduced)

## 3. React `UpdatePrompt` component and helper

- [x] 3.1 Create `src/components/UpdatePrompt.tsx` exporting a side-effect `UpdatePrompt` component (returns `null`) and an exported `runUpdateCheck({ manual })` helper
- [x] 3.2 Gate all update logic on `isTauriRuntime()` from `src/lib/tauri-bridge.ts`
- [x] 3.3 Dynamically import `@tauri-apps/plugin-updater` and `@tauri-apps/plugin-process` inside helper functions so the web preview / Playwright bundle never evaluates them at module load
- [x] 3.4 Use a `useRef` guard so the automatic check runs exactly once per mount even under React StrictMode double-invocation
- [x] 3.5 Render update availability via sonner `toast()` directly, with `action: "Install and restart"` and `cancel: "Later"` buttons
- [x] 3.6 Track download progress by holding a persistent `toast.loading` ID and updating its text on every `Started` / `Progress` / `Finished` event
- [x] 3.7 Format progress as human-readable bytes (B / KB / MB)
- [x] 3.8 Call `relaunch()` from `@tauri-apps/plugin-process` after `downloadAndInstall` resolves
- [x] 3.9 Implement silent-failure branch for auto-check (log to console) and verbose-failure branch for manual check (toast with error detail)
- [x] 3.10 Render the disabled state + helper text for the Settings manual-check button when `isTauriRuntime()` is false

## 4. App wiring

- [x] 4.1 Import `UpdatePrompt` and `runUpdateCheck` at the top of `src/App.tsx`
- [x] 4.2 Mount `<UpdatePrompt />` inside `<LicenseGate>` so the check only runs for licensed users
- [x] 4.3 Add a new "Updates" `Card` to the Settings page with a "Check for updates" `Button` wired to `runUpdateCheck({ manual: true })`, disabled when `isTauriRuntime()` is false

## 5. Operational runbook

- [x] 5.1 Write `docs/runbooks/UPDATER_SETUP.md` covering: interactive keypair generation with `npx @tauri-apps/cli signer generate`, private-key custody, GitHub Actions secret names (`TAURI_UPDATER_PRIVATE_KEY`, `TAURI_UPDATER_KEY_PASSWORD`), pubkey swap in `tauri.conf.json`, end-to-end verification procedure, and a key-rotation procedure

## 6. Verification

- [x] 6.1 `npx tsc --noEmit` — no new TypeScript errors introduced by this change (pre-existing errors in `src/screenshots-harness.tsx` are out of scope)
- [x] 6.2 `cd src-tauri && cargo check` — completes cleanly
- [x] 6.3 `npx openspec validate add-in-app-updater-gui --strict` — passes

<!-- Follow-up work (Prompts 2 and 3) is intentionally not listed here; see `proposal.md` > Impact > "Out of scope". -->

