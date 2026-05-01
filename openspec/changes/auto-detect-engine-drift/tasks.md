## 1. Drift Detection Workflow

- [ ] 1.1 Create `.github/workflows/engine-drift-check.yml` with triggers: `schedule` (cron `0 8 * * *`) and `workflow_dispatch`
- [ ] 1.2 Add permissions block: `contents: write`, `pull-requests: write`
- [ ] 1.3 Add "Read current ENGINE_VERSION" step: strip whitespace, store in `CURRENT`
- [ ] 1.4 Add "Get latest engine release" step: `gh release view --repo Artexis10/endstate --json tagName --jq '.tagName'`, strip leading `v`, store in `LATEST`
- [ ] 1.5 Add "Compare versions (semver)" step: use `node -e` inline script with `require('semver').gt(LATEST, CURRENT)` — semver is available without `npm ci` via Node's built-in module resolution or a one-liner; fallback to `npx --yes semver "$LATEST" -r ">$CURRENT"`
- [ ] 1.6 Add "No drift" early-exit: if `CURRENT == LATEST`, log "ENGINE_VERSION is already at latest (vCURRENT). No drift." and exit 0
- [ ] 1.7 Add "Check for existing bump branch" step: `git ls-remote --exit-code origin bot/bump-engine-vLATEST`; if branch exists, log "PR already open for vLATEST — skipping." and exit 0
- [ ] 1.8 Add "Verify release assets" step: query `gh release view vLATEST --repo Artexis10/endstate --json assets`; check both `endstate.exe` and `endstate.exe.sha256` are present; if missing, log warning and exit 0
- [ ] 1.9 Add "Detect major version bump" step: compare `major(LATEST)` vs `major(CURRENT)`; set env var `MAJOR_BUMP=true` if major increased
- [ ] 1.10 Add "Build PR body" step: construct PR body markdown including engine release URL, commit list (`gh api repos/Artexis10/endstate/compare/vCURRENT...vLATEST --jq '[.commits[].commit.message | split("\n")[0]] | join("\n- ")'`), and major-version warning block when `MAJOR_BUMP=true`
- [ ] 1.11 Add "Update ENGINE_VERSION" step: write `LATEST` to `ENGINE_VERSION` (no trailing newline)
- [ ] 1.12 Add "Open bump PR" step using `peter-evans/create-pull-request@v6`:
  - `branch: bot/bump-engine-vLATEST`
  - `title: feat: bump engine to vLATEST`
  - `body: ${{ env.PR_BODY }}`
  - `commit-message: feat: bump engine to vLATEST`
  - `delete-branch: true` (clean up branch on PR close/merge)

## 2. README Badge

- [ ] 2.1 Add a shields.io badge to `README.md` under the `## Status` section that reads the `ENGINE_VERSION` file from the `main` branch raw URL and displays `engine | vX.Y.Z`; use the static form since the file is version-controlled: `![engine pin](https://img.shields.io/badge/engine-v{VERSION}-blue)` constructed from the current value, updated by the bump PR automatically

## 3. Verification

- [ ] 3.1 Run `workflow_dispatch` with current `ENGINE_VERSION` matching latest engine release — confirm workflow logs "No drift" and exits without opening a PR
- [ ] 3.2 Temporarily set `ENGINE_VERSION` to `1.7.0`, commit, run `workflow_dispatch` — confirm a PR is opened with title `feat: bump engine to v1.8.0` (or current latest)
- [ ] 3.3 Without closing the PR, run `workflow_dispatch` again — confirm no duplicate PR or branch is created
- [ ] 3.4 Close the test PR and restore `ENGINE_VERSION` to `1.8.0`, push
- [ ] 3.5 Run `openspec validate auto-detect-engine-drift --strict` and confirm it passes
