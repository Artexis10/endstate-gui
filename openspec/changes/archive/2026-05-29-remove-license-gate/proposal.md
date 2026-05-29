# Change: Remove license gate and all in-app license code

## Why

The Endstate product strategy (codified in the engine repo's [PRINCIPLES.md](https://github.com/Artexis10/endstate/blob/main/PRINCIPLES.md), linked from this GUI's README) is **free local product + Hosted Backup subscription (server-side gated) + Supporter License (public recognition only — website + SUPPORTERS.md, nothing in-app)**. PRINCIPLES.md states explicitly:

> "Local features never check subscription status against any server."
> "Every part of Endstate that runs on your own machine ... works without a subscription, forever."
> "A subscription buys access to those managed services. It does not gate anything else."

The current `LicenseGate` wraps the entire app in a server-validated gate, exactly the pattern the principles forbid. Buy buttons have already been removed from substratesystems.io, so no users can purchase licenses; meanwhile, existing activated users re-validate against `substratesystems.io/api/license/validate` every 30 days and would be **locked out of their own free product** if that endpoint changed or went away.

There is no future feature path that re-uses this code: PRINCIPLES.md confirms supporter recognition is purely a public-list affair and Hosted Backup auth is server-side, not Ed25519-signed offline activation. The license-activation pipeline (canonical hash format, Windows-only machine fingerprint, 30-day window, `substratesystems.io/api/license` HTTP client, license-shaped JSON cache) is purpose-built and has no general reuse.

## What Changes

- **BREAKING (user-visible):** Remove the activation screen. The app starts directly into the overview screen with no license check. Existing `license.json` cache files are ignored (left orphaned on disk).
- **BREAKING (spec):** Remove the entire `license-gate` capability and its spec.
- **Deleted code:** `src/components/app/LicenseGate.tsx`, `src/components/app/LicenseGate.test.tsx`, `src/lib/license.ts`, `src-tauri/src/license.rs`, `src-tauri/src/license_pubkey.rs`.
- **Deleted Tauri commands:** `activate_license`, `check_license`, `deactivate_license`.
- **Pruned Cargo deps:** `ed25519-dalek`, `winreg`, `hostname`, `reqwest`, `sha2`, `hex`, `chrono` (verified license-only usage).
- **Removed env handling:** `VITE_DEV_BYPASS_LICENSE` no longer referenced in code or `playwright.config.ts`.
- **Removed protected-file entry:** `src-tauri/src/license_pubkey.rs` removed from `docs/ai/PROJECT_RULES.md`.
- **Supersedes** the open `license-bypass-safety-gate` change (no longer applicable: the gate it would harden is gone).

## Impact

- **Affected specs:** `license-gate` (REMOVED — capability and spec deleted entirely).
- **Affected code:**
  - Frontend: `src/App.tsx` (imports, settings section, gate wrap removed), files deleted as listed.
  - Rust: `src-tauri/src/lib.rs` (mod declaration, three command fns, invoke_handler entries removed); two source files deleted; seven Cargo deps removed.
  - Config: `playwright.config.ts` (env var entry removed).
  - Docs: `docs/ai/PROJECT_RULES.md` (protected-file entry removed).
- **User compatibility:** Activated users transition silently to free unlocked. Their `license.json` cache files become orphaned and harmless; no migration code is added (would exist only to clean up code we are already removing).
- **Build:** ~1,800 LOC and three direct Cargo deps removed.
- **Reversibility:** `git revert` restores everything if needed.
- **Out of scope (engine repo):** The engine-repo OpenSpec change `fix-license-activation-canonical-signing` is presumed obsoleted by this strategy shift. Reconciling it lives with the engine repo, not here.
- **Out of scope (other open changes):** `production-sidecar-resolution` contains a "License bypass protection" requirement that is now obsolete. Its author should reconcile when applying that change; this proposal does not modify it.
