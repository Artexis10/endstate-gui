## Why

The Tauri auto-updater silently reports "up to date" even when a newer release exists. The root cause is that `plugins.updater.endpoints` in `tauri.conf.json` points to `https://substratesystems.io/updates/latest.json`, a manually-deployed Vercel static file that was never updated beyond 2.0.0. Because nothing in the release workflow updates that endpoint, every installed version sees `"version": "2.0.0"` and concludes it is current.

## What Changes

- Change `plugins.updater.endpoints` in `tauri.conf.json` to point directly at the GitHub Releases `latest.json` asset — self-maintaining, no external service dependency.
- Add a post-build verification step to `release-please.yml` that hard-fails the workflow if `latest.json` is absent from the release after `tauri-action` completes. Converts a silent failure mode into a loud one.

## Capabilities

### New Capabilities
- `tauri-updater-pipeline`: End-to-end requirements for the auto-updater: endpoint resolves to a current manifest, manifest is uploaded on every release, installed app detects and applies updates correctly.

### Modified Capabilities
<!-- None — endpoint config and CI verification are implementation details, not spec-level requirement changes for existing specs. -->

## Impact

- `src-tauri/tauri.conf.json` — `plugins.updater.endpoints` array
- `.github/workflows/release-please.yml` — new hard-fail verification step after the `tauri-apps/tauri-action` step
- **Manual one-time action required outside this repo**: `substratesystems.io/updates/latest.json` must be updated to serve 2.1.0 data so existing 2.0.0 and 2.1.0 installs (whose binaries have the old endpoint baked in) can bridge to the new endpoint version.
