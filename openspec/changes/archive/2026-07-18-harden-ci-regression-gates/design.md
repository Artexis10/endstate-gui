## Context

The repository already has fast Linux CI, a Windows bundle audit, and a signed draft-release audit. The Windows PR workflow used path filters, which made its check context disappear on unrelated PRs and prevented it from being a stable branch-protection requirement. Normal CI also allowed Cargo to rewrite a stale lockfile and did not prove the production web build.

## Goals / Non-Goals

**Goals:**

- Keep fast, parallel Linux feedback on every pull request.
- Expose one stable, fail-closed installer status for branch protection.
- Run the costly Windows MSI/NSIS audit only for packaging-sensitive changes or manual verification.
- Keep Release Please, Cargo manifests, and `Cargo.lock` synchronized.

**Non-Goals:**

- No dependency upgrades, product behavior changes, or release-version bump.
- No replacement for the signed post-merge release audit.
- No hostile-collaborator security boundary: pull-request workflows can modify their own workflow definition. External fork runs remain subject to GitHub approval and read-only permissions.

## Decisions

- Use a small Linux classifier plus an always-running `bundle-gate`. Requiring the stable gate avoids missing-check deadlocks while preserving the optional Windows job.
- Classify exact files and prefixes in a pure Node module with table-driven tests. Manual dispatch always builds; ordinary UI/docs work skips packaging because production web checks cover it.
- Skip the duplicate unsigned Windows build only for the real Release Please bot, its canonical branch prefix, and an exact allowlist of generated version artifacts. Any extra file fails closed into packaging.
- Compare the enumerated PR file count with GitHub's `changed_files` value and include both new and previous rename paths. Truncated enumeration fails instead of silently skipping packaging.
- Accept only literal `true` or `false` classifier output. Missing or malformed output fails the stable gate.
- Use Release Please's Generic TOML updater with the parser-aware `name.value` selector and run Rust commands with `--locked`.
- Keep branch protection non-strict to avoid redundant rebase reruns, but require all meaningful job contexts after the stable gate has landed.

## Risks / Trade-offs

- Sensitive-path policy can become stale when packaging inputs change → keep policy and workflow contract tests in the resource/release gate; unknown Release Please artifacts force the expensive path.
- Release Please PRs defer unsigned packaging until after merge → the signed release remains draft and non-Latest until build, audit, smoke, and asset verification succeed.
- Pull-request workflow code is not a hostile-collaborator boundary → rely on review/approval for workflow changes; do not expose release secrets to PR builds.

## Migration Plan

1. Merge the layered workflow and policy tests while the existing required check remains active.
2. Confirm the new PR reports all Linux contexts and a successful `bundle-gate`, including the real Windows audit for this packaging-sensitive change.
3. Add `test`, `engine-contract`, `dev-bridge-no-gui-deps`, `e2e`, `verify-engine-pin`, and `bundle-gate` to main-branch required checks with strict rebasing disabled.
4. Roll back by restoring the previous workflows and required-context list; the signed draft-release audit remains the release safety backstop.

## Open Questions

None.
