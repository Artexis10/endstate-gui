## Context

The product strategy (engine repo PRINCIPLES.md, linked from this GUI's README in commit `6f931c3`) defines three tiers: free local product, Hosted Backup subscription gated server-side, and Supporter License with public recognition only (no in-app surface). The current `LicenseGate` blocks the entire app on a server-validated check — the most prominent contradiction of those principles in the codebase. Buy buttons are removed from substratesystems.io; the activation API exists in a payment story that no longer does. Existing users with cached licenses re-validate every 30 days and risk lockout if the endpoint changes.

## Goals / Non-Goals

**Goals:**
- Bring the GUI into compliance with PRINCIPLES.md ("local features never check subscription status against any server").
- Eliminate the lockout risk for already-activated users.
- Remove ~1,800 LOC of license-specific code and three direct Cargo deps that exist only to support a feature that should not exist.
- Leave a clear historical record (this change + REMOVED delta) for future contributors who wonder why.

**Non-Goals:**
- Adding any replacement gating or feature flag (PRINCIPLES.md forbids in-app gating).
- Migrating cached `license.json` files (orphaned but harmless; cleanup code would only exist to clean up other code we are removing).
- Designing v2 hosted-backup auth (separate, future change; will not reuse this code's shape).
- Modifying the engine-repo OpenSpec change `fix-license-activation-canonical-signing` (different repo).
- Modifying the open `production-sidecar-resolution` change (its author owns reconciliation).

## Decisions

### Decision 1: Full removal over dormancy

Two alternatives were considered and rejected:

- **A: Hide UI, keep infrastructure dormant.** Leaves ~1,200 LOC of dead code, dead Cargo deps, dead protected-files entry, and a contradiction-shaped artifact for future contributors to rediscover. Rejected because the cost of half-measures (audit fatigue, "why is this here?" questions) outweighs the cost of full removal.
- **B: Remove UI + commands, keep Rust crypto for "potential reuse".** `license.rs` is 964 lines purpose-built for license activation: hard-coded `substratesystems.io` URL, Windows-specific `MachineGuid` fingerprint, 30-day window, license-shaped JSON cache. None of that is reusable as generic crypto. If v2 hosted-backup auth needs signed tokens it will be JWT/OAuth-shaped, not this. Rejected because "keep for reuse" preserves a Chesterton's fence with no actual reuse on the horizon.

### Decision 2: Remove broader Cargo deps than the original plan listed

The pre-execution plan listed `sha2`, `hex`, `reqwest`, `chrono` as "shared, keep". Verification by grep (`rg "reqwest|sha2|^use\s+hex|hex::|chrono"` across `src-tauri/src/`) showed all four were exclusively used by `license.rs`. They are removed in this change. `base64` is genuinely shared (used in `lib.rs` and `dev_server.rs`) and is kept.

### Decision 3: Leave orphaned `license.json` cache files in place

After removal, users' existing cache files at `%APPDATA%\com.substratesystems.endstate\license.json` are no longer read by anything. Adding one-shot deletion code would exist only to clean up the artifacts of code we're already removing — extra surface, extra tests, no functional benefit. The file is small and Windows reclaims `%APPDATA%` directories on uninstall.

### Decision 4: Don't preemptively design v2 auth

PRINCIPLES.md is explicit: hosted services have a subscription paywall, but it's server-side. The GUI's role for v2 will be to authenticate against the managed service (likely OAuth/JWT) and hand off, not to verify offline-signed licenses. Designing that here would be speculative and would re-introduce the very pattern PRINCIPLES.md forbids. Defer to a future, scoped change when Hosted Backup actually ships.

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| Breaking change for existing activated users | They become unlocked free users — strictly better, not worse. No data loss; orphaned cache file is harmless. |
| `production-sidecar-resolution` open change has obsolete "license bypass protection" requirement | Flagged in `proposal.md`. Its author reconciles when applying that change. Not modified here. |
| Engine-repo OpenSpec change `fix-license-activation-canonical-signing` may scope work that should survive | Out of scope; cross-repo coordination by you. If that change scopes signing primitives for non-activation purposes, those belong in the engine, not the GUI. |
| If v2 auth turns out to want Ed25519 verification | Adding a 50-line `verify_signature` from `ed25519-dalek` is a small future task; not worth retaining 964 lines of license-shaped code preemptively. `git revert` of this change is also available. |
| Cargo dep removal might break a transitive dependent | Verified by grep that none of the seven removed deps are imported elsewhere in `src-tauri/src/`. `cargo build` and `cargo test` confirm. |

## Migration Plan

No staged rollout is needed; the change is internally consistent and verified before merge.

1. Apply this change (delete files, edit `App.tsx`, `lib.rs`, `Cargo.toml`, `playwright.config.ts`, `PROJECT_RULES.md`).
2. Run verification (Section 5 of `tasks.md`).
3. Ship in the next release.
4. On install, existing users start without the activation screen. Their `license.json` cache files are silently ignored.
5. If urgent rollback is needed: `git revert` the merge commit. The change is purely deletive and isolated; revert restores everything.

## Open Questions

- Engine-repo OpenSpec change handling: confirmed out of scope for this PR. (Mention in changelog if you want users to see the cross-repo implication.)
- Future SUPPORTERS.md / website recognition mechanism is not part of this change — it lives outside the app entirely.
