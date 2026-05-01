## Context

The Tauri v2 updater pipeline requires three pieces working together:

1. **Signed artifacts** — `tauri-action` builds the installer, signs it with `TAURI_SIGNING_PRIVATE_KEY`, and uploads `.exe`, `.msi`, and corresponding `.sig` files. This part works (`bundle.createUpdaterArtifacts: true`; signing keys set; `latest.json` confirmed present on 2.0.0 release).

2. **Update manifest** — `tauri-action` also generates and uploads `latest.json` to the GitHub Release. This file lists the current version, per-platform download URLs, and signatures. Confirmed working in 2.0.0.

3. **Reachable endpoint** — The installed binary polls the URL(s) in `plugins.updater.endpoints` at launch / on demand. If the endpoint serves a version ≤ the installed version, the updater reports "up to date". **This is broken**: the endpoint (`substratesystems.io/updates/latest.json`) is a manually-deployed Vercel static file frozen at `version: 2.0.0` and never updated when new releases ship.

The fix is to replace the endpoint with the GitHub Releases `latest/download/latest.json` URL, which always serves the most recently published `latest.json` without any per-release intervention.

## Goals / Non-Goals

**Goals:**
- Installed app detects available updates automatically without any manual endpoint maintenance
- CI hard-fails loudly if `latest.json` is absent from a release (prevents silent recurrence)
- Existing 2.0.0 / 2.1.0 installs can still bridge to newer versions (via one-time manual `substratesystems.io` update — external to this repo)

**Non-Goals:**
- Replacing or modifying the `substratesystems.io` Vercel deployment (out of scope — external service not in this repo)
- Changing how artifacts are signed or how `tauri-action` generates `latest.json` (already working)
- Adding in-app UI for update prompts (dialog is intentionally `false`; frontend update flow is separate)

## Decisions

### D1: Use `releases/latest/download/latest.json` as the endpoint

**Decision**: Set `plugins.updater.endpoints` to `https://github.com/Artexis10/endstate-gui/releases/latest/download/latest.json`.

**Rationale**: GitHub's CDN transparently serves the `latest.json` from the most recent published release at this stable URL. No per-release CI step needed, no external service to maintain. `tauri-action` already uploads `latest.json` to each release — wiring the endpoint directly to GitHub releases makes the pipeline self-maintaining.

**Alternative considered**: Keep `substratesystems.io` and add a CI step (e.g., Vercel deploy) to push `latest.json` after each build. Rejected: requires a `VERCEL_TOKEN` secret, couples the release pipeline to the website deployment, and adds a new failure mode.

### D2: Hard-fail the release workflow if `latest.json` is missing

**Decision**: After `tauri-apps/tauri-action` completes, add a `gh release view` check that verifies `latest.json` is present in the release assets. Exit non-zero if absent.

**Rationale**: The silent failure mode (release ships without `latest.json`, updater silently says "up to date") is worse than a loud CI failure. If `tauri-action` ever stops generating the manifest, the release job must fail visibly rather than shipping a broken update path.

### D3: Bridge existing installs via one-time manual update (out of scope)

2.0.0 and 2.1.0 installs have `substratesystems.io` baked into their binaries. The endpoint change only takes effect in the next release. The `substratesystems.io` endpoint must be manually updated once to serve 2.1.0 (or later) data — this is documented here but implemented outside this repo.

## Risks / Trade-offs

- **GitHub CDN availability** → If GitHub's CDN is down, update checks fail silently (the updater retries at next launch). Acceptable: same risk profile as downloading the installer.
- **Bridge gap for 2.0.0 / 2.1.0 installs** → These installs will not detect updates until `substratesystems.io` is manually updated to serve newer version data. Mitigation: documented as a manual step; low user base at this stage.
- **`latest/download/latest.json` requires a published release** → If a release is created but not published (draft), the endpoint 404s. Mitigation: release-please creates releases as published, not drafts. The hard-fail check (D2) would also catch a missing manifest before users see it.

## Migration Plan

1. Merge this change — `tauri.conf.json` endpoint is updated, CI verification step is added.
2. Next release (2.2.0+) ships with the new endpoint baked into the binary. All 2.2.0+ installs auto-poll GitHub releases.
3. **Manual external step**: Update `substratesystems.io/updates/latest.json` to serve 2.2.0 data, so 2.0.0 / 2.1.0 installs detect and upgrade to 2.2.0 (which has the self-maintaining endpoint).
4. After step 3, `substratesystems.io` endpoint is no longer load-bearing for future updates and can be left as-is or redirected.

## Open Questions

- None. Root cause and fix are confirmed by live diagnostic (endpoint serves stale 2.0.0 data; `latest.json` is already generated by `tauri-action`).
