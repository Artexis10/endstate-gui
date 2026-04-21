## Why

Prompt 1 (PR #18) wired a Tauri v2 updater into the GUI that only installs bundles whose ed25519 signatures verify against the pubkey in `tauri.conf.json`. The existing release workflow produces NSIS and MSI installers but does not sign them and does not emit the `.sig` sidecar files the updater needs. Until signing is wired into CI, the updater is permanently dormant and no customer can ever receive an update. This change extends the release workflow to produce signed, updater-compatible artifacts on every release. It is the second of three sequential changes; manifest hosting (Prompt 3) remains a separate proposal.

## What Changes

- Replace the hand-rolled `build` job in `.github/workflows/release-please.yml` with `tauri-apps/tauri-action@v0`, which treats signing as a first-class step of the build lifecycle.
- Inject two signing environment variables on the `build` job sourced from existing GitHub Actions secrets. Secret names match the Tauri CLI env-var contract exactly, so no translation layer is needed:
  - `TAURI_SIGNING_PRIVATE_KEY` from secret `TAURI_SIGNING_PRIVATE_KEY`
  - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` from secret `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
  - Both secret names are documented in `docs/runbooks/UPDATER_SETUP.md`.
- Produce a sibling `.sig` file for each installer bundle. Attach `*.exe`, `*.exe.sig`, `*.msi`, `*.msi.sig` to the GitHub Release as assets.
- Preserve the existing engine checkout (`Artexis10/endstate` pinned via `ENGINE_REF`), the Go ldflags embedding of `VERSION` / `SCHEMA_VERSION`, the sidecar triple copy, and the release-please-driven release body. The switch is additive with respect to those concerns.

## Capabilities

### New Capabilities
<!-- None. -->

### Modified Capabilities
- `auto-release`: adds signing + `.sig` asset output to the existing "Build Windows installers in CI" and "Attach installer artifacts to GitHub Release" requirements; adds a new requirement capturing the CI signing secret contract.

## Impact

- Affected code:
  - `.github/workflows/release-please.yml` — `build` job rewritten around `tauri-apps/tauri-action@v0`.
- New dependencies:
  - GitHub Action: `tauri-apps/tauri-action@v0` (already used implicitly via `tauri build` today, now invoked directly).
- Secrets consumed (no new secrets created by this change):
  - `TAURI_SIGNING_PRIVATE_KEY` — populated as part of the operator steps that preceded this PR.
  - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — same.
- Security surface: the root of trust for the updater chain shifts to whatever environment signs in CI. If the private key leaks, an attacker can sign a malicious bundle that existing installs will accept. Mitigation is policy + rotation (documented in the runbook), not CI-side enforcement.
- Out of scope:
  - Generating the ed25519 keypair (already done by the operator).
  - Replacing the placeholder pubkey in `tauri.conf.json` (landed on PR #18 alongside the GUI integration).
  - Hosting `latest.json` — Prompt 3.
  - End-to-end validation of a signed release installing on a customer machine; this change enables it but verification happens on the first real release after merge.
