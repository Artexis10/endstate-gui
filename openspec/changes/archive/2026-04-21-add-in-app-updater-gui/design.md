## Context

The Endstate GUI is a Tauri v2 desktop app that also runs in a plain web browser during development (the "web preview") and in Playwright E2E. Until this change, new versions reached customers only when they manually downloaded a fresh installer from the GitHub Release. This change adds the *client* side of an in-app update pipeline so that when signed release artifacts and a manifest endpoint eventually exist, the running app can detect, download, verify, and install an update on its own.

This is the first of three sequential changes. The release-workflow signing step and the `latest.json` hosting endpoint are deliberately deferred to follow-on proposals so that each PR is independently reviewable. As a result, on the day this change lands, **no real update can succeed** — the placeholder pubkey and the yet-to-exist endpoint guarantee `updater.check()` fails silently. That silence is a property, not a bug: customers must not see update errors before the release pipeline catches up.

Existing patterns that constrain the design:
- `src/lib/tauri-bridge.ts` is the only module allowed to import `@tauri-apps/api/*`. It exports `isTauriRuntime()` for runtime detection and exposes `safeInvoke` / `safeListen` wrappers. This file does *not* import the updater plugin — it's one level too low, and we don't want bridge failures to break the rest of the app.
- `ToastProvider` (sonner) is mounted at the app root; `showToast()` is the shared wrapper but doesn't expose `action`/`cancel` slots or persistent IDs.
- `LicenseGate` wraps `AppContent`. Nothing inside `LicenseGate` runs until the user is licensed.
- The web preview and Playwright tests both end up with `isTauriRuntime() === false`. Anything that hard-imports a Tauri plugin at module load time will crash these environments.

## Goals / Non-Goals

**Goals:**
- Check for updates automatically once per app launch, silently, with zero network errors surfaced to the user.
- Let a user trigger a manual check from Settings and see a human answer (up-to-date / available / failed).
- Install-and-restart in one click, with clear progress feedback while the bundle downloads.
- Keep web preview and Playwright bundles buildable and crash-free despite introducing two Tauri-only plugins.
- Keep update surface area small and auditable — a single component, a single helper, one mounting site.

**Non-Goals:**
- Generating ed25519 keypairs, storing private keys, or configuring CI secrets. Those are operator steps documented in `docs/runbooks/UPDATER_SETUP.md`.
- Signing or publishing artifacts in CI. That's Prompt 2 (`auto-release` capability extension).
- Serving `latest.json`. That's Prompt 3 (Vercel API route on `substratesystems.io` backed by the GitHub Releases API).
- A nag / reminder / snooze system. "Later" just dismisses the toast for this session; the next launch will re-check.
- Per-machine opt-out or staged rollout. All licensed installs check the same endpoint.
- Rollback of a bad update. If a signed bundle ships and bricks customers, the fix is a new signed release, not client-side recovery.

## Decisions

**Decision: `dialog: false` — custom React toast UX, not Tauri's built-in dialog.**
Tauri's built-in updater dialog is functional but visually unbranded and offers no control over copy, placement, or progress display. The rest of the app already uses sonner toasts for non-blocking notifications, so an update prompt that looks like any other toast fits the existing design language. Cost: we own all of the UX — progress, errors, retries — instead of getting them for free.
*Alternatives considered:* Leave `dialog: true` for the first release and replace later. Rejected because reverting a prompt style users have already seen is a worse transition than getting it right the first time, and because the dialog can't be triggered from "Check for updates" in Settings without extra plumbing anyway.

**Decision: Dynamic imports for both `@tauri-apps/plugin-updater` and `@tauri-apps/plugin-process`.**
Hard static imports would mean the web preview and Playwright (neither of which has the Tauri runtime) attempt to resolve these modules at bundle load. The plugin packages *do* load in a browser — the crash comes when they try to call into `window.__TAURI_INTERNALS__` — but we want zero work and zero risk in the non-Tauri case. Dynamic imports, gated on `isTauriRuntime()`, guarantee the code path is fully short-circuited.
*Alternatives considered:* Add plugin specifiers to Vite's `optimizeDeps.exclude` and rely on tree-shaking. Brittle; one innocuous top-level side effect in the plugin package undoes it. Dynamic import is the explicit, documented contract.

**Decision: Mount `<UpdatePrompt />` *inside* `<LicenseGate>`, not above it.**
If an update were available before licensing, a toast over the license activation screen would be disorienting and would race with the gate's own UI. Mounting inside `LicenseGate` means the auto-check only fires after the user has passed the gate, which matches "in-app" as users experience it. Side benefit: the check runs in a context where `AppContent` already exists, so any future commands we want to invoke from the update flow already have the Tauri handlers registered.
*Alternatives considered:* Mount at the very root to maximize the window for a check. Rejected; the extra seconds aren't worth the UX collision.

**Decision: Use sonner's `toast()` directly, not the shared `showToast()` wrapper.**
The install flow needs three things `showToast()` doesn't expose: an action button ("Install and restart"), a cancel button ("Later"), and a persistent toast ID so the download progress toast can be updated in place as chunks arrive. Rather than expanding `showToast()` for this one caller, the updater code imports sonner directly. The `ToastProvider` is still the host — styling and icons flow from it — so visual consistency is preserved.
*Alternatives considered:* Extend `showToast()` to accept optional `action`, `cancel`, and `id` parameters. Defensible but risks turning a simple helper into a leaky abstraction; deferred until a second caller needs the same.

**Decision: Run the auto-check exactly once per session, using a `useRef` guard in `UpdatePrompt.tsx`.**
`useEffect` can re-fire in dev (React StrictMode double-invocation) and across remounts. A ref-based `didCheck` guard makes the check idempotent. "Later" doesn't need any extra state because no re-prompt is scheduled — the in-memory guard is sufficient.
*Alternatives considered:* Store a "dismissed this session" flag in `sessionStorage`. Unnecessary — a page reload in Tauri means a new app session, which is exactly when we *want* to re-check.

**Decision: Silent failure on auto-check; verbose on manual check.**
The auto-check fires without user intent. Exposing a "couldn't reach update server" toast on every offline launch is annoying and teaches users to dismiss update UI. The manual check is explicitly initiated, so silent behavior there would feel broken — errors must surface. This is mirrored in the `runUpdateCheck({ manual })` signature: the boolean routes every branch (network error, sig fail, no-update, error) to either console or toast.

**Decision: Placeholder pubkey (`REPLACE_WITH_ACTUAL_PUBLIC_KEY`) committed on purpose.**
Committing a real key would require generating it now. Generation is interactive (password prompt) and the private half must be stored in the team vault before any CI run, so it's blocked on an operator step. The placeholder value fails signature verification 100% of the time, which is the safe failure mode: no update can succeed, no customer can be attacked via a compromised unsigned artifact. The runbook is the explicit handoff.

## Risks / Trade-offs

- **Placeholder pubkey masks real wiring bugs** → Mitigation: the runbook's "Verify" step requires shipping a real key and cutting a test release before declaring the pipeline healthy. CI cannot observe this; it's an operator responsibility.
- **Silent auto-check errors hide a broken endpoint** → Mitigation: the manual "Check for updates" button exists precisely so support can ask a user "click this, what does it say?" and get a real error message. Console logging (`[updater] silent check failed:`) is available in devtools for advanced diagnosis.
- **Dynamic import adds a small first-check latency** → Mitigation: acceptable — the check is async and off the critical path. Page paint and license gate unblock without waiting for the updater module.
- **`process:allow-restart` grants the app the ability to restart itself from JS** → Acceptable because the same capability file already exposes `shell:allow-execute` for the engine sidecar; the trust boundary hasn't moved. The capability is also scoped to the `main` window only.
- **`dialog: false` means no update UX if the React tree is crashed** → If the app is broken enough that React can't render, it can't prompt for the update that might fix itself. Mitigation: Tauri's updater can be re-enabled (`dialog: true`) in a future hotfix if this ever bites; for now, the probability-weighted risk is low.
- **`updater.check()` is called from inside `LicenseGate`, so an unlicensed user will never see an update prompt** → Intentional. Mitigation: the manual check in Settings is also gated on being logged in, which matches every other Settings action.

## Migration Plan

No migration is needed for end users in this change — the feature is dormant until Prompts 2 and 3 land. Rollout sequence across all three changes:

1. **This change (Prompt 1):** GUI integration ships. Placeholder pubkey. No real update ever succeeds. Zero user-visible change on launch (silent auto-check finds nothing / errors silently).
2. **Prompt 2:** Release workflow signs NSIS + MSI and emits `.sig` files; real pubkey replaces the placeholder. Still no manifest, so `updater.check()` 404s silently.
3. **Prompt 3:** Vercel API route at `https://substratesystems.io/updates/latest.json` proxies the GitHub Releases API. First real update prompt reaches customers on the *next* release after this endpoint goes live.

Rollback for this change alone: revert the PR. The capability is additive — no existing feature depends on the updater being present. If the dynamic imports cause any unexpected bundle regression, the plugin lines can be removed from `App.tsx` in isolation without touching the rest of the app.
