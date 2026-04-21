## Context

The existing `release-please.yml` was shaped incrementally. `release-please` (Ubuntu job) creates the tag and release. A Windows `build` job then checks out a pinned revision of the `endstate` engine repo, builds the Go engine with version `-ldflags`, copies the binary into the Tauri sidecar location, runs `npm run tauri build`, and uploads installers via `softprops/action-gh-release@v2`. Signing is nowhere in that chain.

Tauri v2's updater verifies every bundle against an ed25519 signature. The signing step produces a small `.sig` file next to the bundle; the updater downloads both, verifies the signature against the pubkey baked into `tauri.conf.json`, and only then installs. Without `.sig` files being attached to releases, the updater pipeline is permanently broken end-to-end regardless of how correct the GUI code is.

Tauri publishes a first-party action — `tauri-apps/tauri-action@v0` — whose whole job is to run `tauri build`, sign the bundles, and (optionally) upload them to a release. It reads `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` from the environment and expects nothing else. The env-var names are a hard contract with the Tauri CLI, not an action detail, so they cannot be renamed.

## Goals / Non-Goals

**Goals:**
- Every future release produces four assets per platform: `*.exe`, `*.exe.sig`, `*.msi`, `*.msi.sig`.
- Signing happens inside a single first-party step instead of being bolted on after an opaque build.
- Preserve the engine ldflags behavior so build reproducibility (commit 6a18fb9) is not regressed.
- Preserve the release-please-driven release body and tag naming.

**Non-Goals:**
- Key generation, key custody, or pubkey swap in `tauri.conf.json`. All operator steps, documented in `docs/runbooks/UPDATER_SETUP.md`.
- End-to-end updater validation — that happens when Prompt 3 lands and a real release hits production.
- Multi-platform (macOS / Linux) signing. The bundle ships Windows-only today; adding platforms is out of scope here.
- Replacing `release-please` itself. The Ubuntu `release-please` job that creates the tag stays exactly as it is.
- SignPath / Authenticode code signing. That's a separate concern from updater signatures — Authenticode protects the installer from Windows SmartScreen, updater signatures protect the update bundle from tampering. This change only addresses the latter.

## Decisions

**Decision: Replace the `build` job's upload step with `tauri-apps/tauri-action@v0` rather than extending the current `softprops/action-gh-release` path.**
`tauri-action` bundles four steps that today live in separate hand-written shell snippets: `npm ci`, `tauri build`, artifact collection, and release upload. It also honors `TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` natively — no shelling out to `tauri signer` manually. Extending the existing path would mean either (a) adding a separate post-build `tauri signer sign` invocation per bundle (brittle; has to track bundle paths that tauri-action knows internally) or (b) hand-rolling key injection + re-packaging (reinvents the action). Using the first-party action is the documented path; deviating from it in this repo would be surprising.
*Alternatives considered:* Keep `softprops/action-gh-release` + add a dedicated signing step with `npx @tauri-apps/cli signer sign`. Rejected because the sign step would have to know the exact bundle paths tauri already outputs, which are tauri's implementation detail, not a public contract. `tauri-action` is the stable seam.

**Decision: Keep the Go engine build as a separate pre-step; pass `SKIP_ENGINE_BUILD=1` into the tauri-action invocation.**
`tauri-action` wraps `tauri build`, which in turn runs the repo's `prebuild` script (`scripts/rebuild-engine.cjs`). The current workflow builds the engine manually before invoking tauri and sets `SKIP_ENGINE_BUILD=1` to prevent a double-build. Keeping that structure lets the existing engine-pinning behavior (`ENGINE_REF`, ldflags, sidecar copy) continue working without refactoring it into tauri-action's build lifecycle. The env var survives because `tauri-action` inherits the job environment.
*Alternatives considered:* Move engine build inside tauri-action via `preBuildCommand`. Rejected — `preBuildCommand` runs inside tauri-action's own invocation context, breaking the current assumption that the engine repo is checked out and linked at a specific workspace-relative path before `tauri build` runs.

**Decision: Use `tauri-action`'s built-in release upload rather than uploading manually after the step.**
`tauri-action` accepts `releaseId` (or `tagName` + `releaseName`) and uploads bundles + `.sig` files to the referenced release. Since the release-please job creates the release on the same workflow run, we can pass the release ID / tag through a job output. This is simpler than collecting bundle paths post-step and re-uploading with `softprops`.
*Alternatives considered:* Let tauri-action build only, then continue using `softprops/action-gh-release@v2` to upload. Workable but duplicates upload logic; tauri-action already knows where its outputs are and `softprops` doesn't know about `.sig` files unless we enumerate them, which is fragile.

**Decision: No changes to `tauri.conf.json` or capabilities in this PR.**
The placeholder pubkey (`REPLACE_WITH_ACTUAL_PUBLIC_KEY`) stays in place. Replacing it requires running the `npx @tauri-apps/cli signer generate` command and putting the resulting private key into GH secrets — both operator steps per the runbook. Merging this PR before those operator steps complete is harmless: `tauri-action` with unset `TAURI_SIGNING_PRIVATE_KEY` either fails the build (good — surfaces the gap immediately) or produces unsigned bundles (bad — could mask the gap). Per Tauri docs, tauri-action fails the build when signing env is missing AND at least one bundle target requires signing. The updater-enabled targets (NSIS/MSI in our config) require signing, so a merge before secrets exist will red-light the first release workflow run — the desired outcome.

**Decision: Single surgical edit to `release-please.yml`; no broader CI reorganization.**
The file has comments, engine-pin documentation, and release-please wiring that work as-is. Touching those is scope creep.

## Risks / Trade-offs

- **First release after merge fails loudly** → Acceptable. The failure surfaces the missing-secret operator gap exactly when it becomes blocking. Easier to fix than a silent-unsigned release.
- **`tauri-action` tracks a moving target** — pinning `@v0` follows Tauri's stable major; but minor changes could alter output path shape → Mitigation: the job only consumes the action's release-upload behavior, not its output paths directly. Risk limited to the action's contract with GitHub's release API.
- **The private key lives in GH Actions secrets** → Non-repudiable blast-radius if an actor with write access to the repo's Actions runs a workflow that echoes the secret. Mitigation is policy (restrict who can modify workflows, require PR review for any `.yml` change under `.github/workflows/`). This is a step up from today where there's no key at all, not a step down.
- **Tauri-action and engine ldflags could interact unexpectedly on future upgrades** → Mitigation: pin `ENGINE_REF` already exists. If tauri-action begins conflicting with the separate Go build step, the fix is to move the Go build into `preBuildCommand` — a follow-up, not a blocker.
- **`.sig` files are binary-ish opaque blobs** → If a release is republished or assets are manually re-uploaded out-of-band, the signature must match the installer byte-for-byte. Operator discipline; no code-level enforcement. Documented in the runbook under the rotation procedure.

## Migration Plan

No user-visible migration. Rollout is entirely CI:

1. **Merge this change.** `release-please.yml` now references tauri-action + signing env.
2. **Operator step** (required before next release): run keypair generation per `docs/runbooks/UPDATER_SETUP.md`, populate `TAURI_UPDATER_PRIVATE_KEY` + `TAURI_UPDATER_KEY_PASSWORD` secrets, replace the placeholder pubkey in `tauri.conf.json`, land that follow-up PR.
3. **Next release.** release-please creates a release; the `build` job runs tauri-action; signed bundles + `.sig` files land on the GitHub Release.
4. **Prompt 3 (separate).** Vercel API route at `substratesystems.io` proxies GitHub Releases API to emit `latest.json`. Only then does any existing install actually update.

**Rollback:** revert the PR. The `build` job returns to the manual shell path; unsigned `.exe` / `.msi` still attach via `softprops`. No data lost. No customer impact because no install has ever successfully verified a signature yet (placeholder pubkey + missing secrets).
