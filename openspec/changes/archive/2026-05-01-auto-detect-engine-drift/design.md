# Design: Auto-detect Engine Drift

## Context

`ENGINE_VERSION` at repo root pins which pre-built engine binary CI downloads. The file is edited manually whenever the engine ships a new release. There is no reminder, no automation, and no visibility into the gap — the GUI just quietly ships an older engine until someone notices.

The engine releases follow semver and publishes `endstate.exe` + `endstate.exe.sha256` as GitHub Release assets. The GUI's CI workflow already reads `ENGINE_VERSION` and downloads those assets; this change adds the layer that detects when `ENGINE_VERSION` is stale and opens the bump PR automatically.

## Goals / Non-Goals

**Goals:**
- Daily drift check that compares `ENGINE_VERSION` with the latest engine release
- Proper semver comparison (handles `1.10.0 > 1.9.0` correctly)
- PR opened automatically when drift detected; idempotent on re-runs
- `feat:` PR title so release-please counts the merge as a minor bump
- Major-version warning in PR body
- Guard: skip bump if engine release assets are missing (incomplete release)
- README badge showing current pinned version

**Non-Goals:**
- Auto-merging the bump PR (human approval required)
- Pinning patch-level bumps differently from minor bumps
- Notifying via Slack/email (PR is the notification channel)
- Watching for pre-releases or draft releases

## Decisions

### Decision 1: Semver comparison via `npx semver`

The `semver` package ships with every Node.js install and is already a transitive dependency. `npx semver "$LATEST" -r ">$CURRENT"` exits 0 if LATEST is strictly greater, 1 otherwise. This correctly handles `1.10.0 > 1.9.0` without shell arithmetic or custom parsing.

Alternatives considered:
- Shell arithmetic on split version parts — fragile with leading zeros, error-prone to write and maintain.
- A small inline Python script — works but adds a language dependency for a one-liner operation.
- `sort -V` — available on Linux runners but not portable; wrong exit-code semantics.

### Decision 2: `feat:` PR title — release-please contract

release-please determines the GUI's next version from merged commit messages (or squash-PR titles). A `feat:` merge bumps the minor version. Since the engine version pin is user-visible behavior, a minor bump is correct. Using `chore:` would silently drop it from the changelog and not bump the version.

The bot does not control the merge commit message directly; it controls the PR title, which GitHub uses as the default squash commit message. The PR title `feat: bump engine to vX.Y.Z` is therefore the lever.

### Decision 3: Idempotency via branch name check

Before opening a PR, the workflow checks whether a branch named `bot/bump-engine-vX.Y.Z` already exists on the remote. If it does, it exits 0 without creating a duplicate. This is simpler and more reliable than querying open PRs by title.

`peter-evans/create-pull-request@v6` also has built-in idempotency (it updates an existing PR on the same branch rather than creating a duplicate), so the two guards layer: the explicit branch check prevents a spurious `git push`, and the action's own idempotency handles any race.

### Decision 4: Asset guard before opening PR

If the latest release exists but lacks `endstate.exe` or `endstate.exe.sha256`, the engine release is incomplete and CI would fail if the bump were merged. The workflow checks assets before updating `ENGINE_VERSION` and logs a warning + exits 0 (no PR, no noise) when assets are missing.

### Decision 5: Major-version warning in PR body

A major bump (`v1.x.x → v2.x.x`) likely includes breaking changes in the CLI contract. The PR body includes a prominent `⚠ Major version bump — review breaking changes before merging.` block so reviewers don't miss it. Minor and patch bumps get no special treatment.

### Decision 6: README badge

A static `ENGINE_VERSION` badge using shields.io's `endpoint` format reads the file at a GitHub raw URL. This gives instant visibility on the repo homepage without any additional infrastructure.

## Risks / Trade-offs

- **`feat:` on every engine bump bumps GUI minor version** — this is intentional but means frequent `0.x` → `0.x+1` increments. Acceptable given semver conventions; can be reconsidered if engine releases become too frequent.
- **Branch-exists check uses `git ls-remote`** — requires network access to the remote, which is always available in GitHub Actions but adds ~1 s to the job.
- **Daily schedule may be noisy if engine ships many releases** — one PR per engine version, idempotent, so at most one open PR at any time. Acceptable.
- **`npx semver` requires network on cold runners** — `semver` is in `node_modules` from `npm ci`, but we deliberately skip `npm ci` to keep the job fast. Adding `--yes` to `npx` downloads from npm registry if not cached. Fallback: inline the two-line Node.js comparison directly.

## Migration Plan

1. Add `.github/workflows/engine-drift-check.yml`
2. Add README badge
3. Verify via `workflow_dispatch` with current ENGINE_VERSION (no-drift path)
4. Verify via `workflow_dispatch` after temporarily pinning an older version (drift path)
5. Close test PR, restore ENGINE_VERSION

No rollback needed — the workflow is additive; deleting the file reverts to manual bumps.

## Open Questions

- Should patch-level bumps also use `feat:`? Currently yes (any bump is user-visible). Could be changed to `fix:` for patches if preferred.
