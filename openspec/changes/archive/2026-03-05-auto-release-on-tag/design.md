## Context

The project uses semantic versioning with a CHANGELOG.md following Keep a Changelog format. Version bumps are committed and tagged manually. There is no automation to create GitHub Releases from these tags.

## Goals / Non-Goals

**Goals:**
- Automate GitHub Release creation when a `gui-v*` tag is pushed
- Populate release body from the matching CHANGELOG.md section
- Zero-config: no secrets beyond the default `GITHUB_TOKEN`

**Non-Goals:**
- Building or uploading binaries (Tauri build pipeline is separate)
- Automating the tagging or version-bump step itself
- Release drafts or approval workflows

## Decisions

1. **Tag pattern `gui-v*`** — Namespaced to avoid collision if the repo hosts multiple releasable artifacts in the future. Version extracted by stripping the `gui-v` prefix.

2. **`softprops/action-gh-release@v2`** — Mature, widely-used action. Handles idempotent release creation, body injection, and `make_latest` flag. Alternative (`gh release create` in a run step) works but requires more scripting for edge cases.

3. **Changelog extraction via `awk`** — Simple inline script that pulls lines between `## [x.y.z]` headers. No external tooling needed. Falls back to "See CHANGELOG.md" if the version section is missing.

4. **Write body to temp file** — Avoids shell quoting and multi-line string issues in GitHub Actions expression context. The action's `body_path` input reads from file.

## Risks / Trade-offs

- **Missing changelog section** — If a tag is pushed before CHANGELOG.md is updated, the release body will say "See CHANGELOG.md". This is acceptable; the release still gets created and can be edited manually. → Mitigation: document the release checklist (update changelog before tagging).
- **Tag on wrong commit** — The workflow checks out the tagged commit, so CHANGELOG.md must contain the version section at that ref. → Same mitigation as above.
