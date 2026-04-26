## 1. Frontend removal

- [x] 1.1 Remove `LicenseGate`, `useLicenseGate`, `deactivateLicense` imports from `src/App.tsx`.
- [x] 1.2 Remove `<LicenseSettingsSection />` invocation and the `LicenseSettingsSection` function from `src/App.tsx`.
- [x] 1.3 Remove `<LicenseGate>` wrapper from `App()` in `src/App.tsx`; render `<UpdatePrompt />` and `<AppContent />` directly under `<ToastProvider>`.
- [x] 1.4 Delete `src/components/app/LicenseGate.tsx`.
- [x] 1.5 Delete `src/components/app/LicenseGate.test.tsx`.
- [x] 1.6 Delete `src/lib/license.ts`.

## 2. Rust backend removal

- [x] 2.1 Remove `mod license;` and `mod license_pubkey;` from `src-tauri/src/lib.rs`.
- [x] 2.2 Remove `activate_license`, `check_license`, `deactivate_license` Tauri command fns from `src-tauri/src/lib.rs`.
- [x] 2.3 Remove the three commands from the `invoke_handler![...]` macro in `src-tauri/src/lib.rs`.
- [x] 2.4 Delete `src-tauri/src/license.rs`.
- [x] 2.5 Delete `src-tauri/src/license_pubkey.rs`.

## 3. Cargo and config

- [x] 3.1 Remove from `src-tauri/Cargo.toml`: `ed25519-dalek`, `winreg`, `hostname`, `reqwest`, `sha2`, `hex`, `chrono` (verified license-only usage by grep).
- [x] 3.2 Remove `VITE_DEV_BYPASS_LICENSE` env entry and its comment from `playwright.config.ts`.
- [x] 3.3 Remove `src-tauri/src/license_pubkey.rs` line from the protected-files list in `docs/ai/PROJECT_RULES.md`.

## 4. OpenSpec hygiene

- [x] 4.1 Add this change at `openspec/changes/remove-license-gate/`.
- [x] 4.2 Add spec delta `specs/license-gate/spec.md` with `## REMOVED Requirements` covering every requirement in the current spec.
- [ ] 4.3 On apply (separate session/PR): delete `openspec/specs/license-gate/spec.md` and the open `openspec/changes/license-bypass-safety-gate/` directory.

## 5. Verification

- [ ] 5.1 `npx tsc --noEmit` — no errors, no dangling license imports.
- [ ] 5.2 `cd src-tauri && cargo build` — builds clean, no unused-dep warnings for `ed25519-dalek`/`winreg`/`hostname`/`reqwest`/`sha2`/`hex`/`chrono`.
- [ ] 5.3 `cd src-tauri && cargo test` — passes; ~25 license tests gone, others unchanged.
- [ ] 5.4 `npx vitest run` — passes; LicenseGate.test.tsx deleted, no other test imports it.
- [ ] 5.5 `npm run openspec:validate -- --all --strict --no-interactive` — passes.
- [ ] 5.6 Manual: `npm run tauri dev` boots straight into the overview screen with no activation modal and no network request to `substratesystems.io`.
