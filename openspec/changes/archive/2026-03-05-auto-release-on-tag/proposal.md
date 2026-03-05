## Why

There is no automated release process. Version bumps require manually creating GitHub Releases with changelog notes. A push-tag-and-forget workflow removes friction and ensures every tagged version gets a corresponding GitHub Release with the correct changelog body.

## What Changes

- Add a GitHub Actions workflow (`.github/workflows/release.yml`) that triggers on `gui-v*` tags
- The workflow extracts the version from the tag, pulls the matching section from `CHANGELOG.md`, and creates a GitHub Release via `softprops/action-gh-release`
- If no changelog section is found, falls back to "See CHANGELOG.md"

## Capabilities

### New Capabilities
- `auto-release`: GitHub Actions workflow that creates a GitHub Release with changelog body when a `gui-v*` tag is pushed

### Modified Capabilities

(none)

## Impact

- New file: `.github/workflows/release.yml`
- Requires `contents: write` permission on the GitHub token (default for repo-scoped workflows)
- No application code changes; CI/CD only
