## 1. Fix Updater Endpoint

- [x] 1.1 In `src-tauri/tauri.conf.json`, change `plugins.updater.endpoints` from `["https://substratesystems.io/updates/latest.json"]` to `["https://github.com/Artexis10/endstate-gui/releases/latest/download/latest.json"]`

## 2. Add Hard-Fail latest.json Verification to Release Workflow

- [x] 2.1 In `.github/workflows/release-please.yml`, after the `tauri-apps/tauri-action` step, add a `Verify latest.json uploaded` step that runs `gh release view <tagName> --json assets --jq '.assets[].name'` and hard-fails (exit 1) if `latest.json` is not in the output

## 3. Verification

- [x] 3.1 Confirm `tauri.conf.json` endpoint is `https://github.com/Artexis10/endstate-gui/releases/latest/download/latest.json`
- [x] 3.2 Confirm the release workflow hard-fail step is present and syntactically correct (validate via `openspec validate` or manual YAML inspection)
- [ ] 3.3 Trigger a `workflow_dispatch` build on the existing `gui-v2.1.0` tag to confirm `latest.json` is present in the release assets after it completes (the in-progress build should already do this, but verify)
- [ ] 3.4 Confirm `https://github.com/Artexis10/endstate-gui/releases/latest/download/latest.json` is reachable and returns `version: 2.1.0` (or current latest) after the build completes
