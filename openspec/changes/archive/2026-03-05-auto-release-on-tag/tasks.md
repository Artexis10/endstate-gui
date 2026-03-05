## 1. Workflow File

- [x] 1.1 Create `.github/workflows/release.yml` with `on: push: tags: ['gui-v*']` trigger
- [x] 1.2 Add version extraction step that strips `gui-v` prefix from `GITHUB_REF_NAME`
- [x] 1.3 Add changelog extraction step using `awk` to pull the matching version section, with "See CHANGELOG.md" fallback
- [x] 1.4 Add release creation step using `softprops/action-gh-release@v2` with `name`, `body_path`, and `make_latest: true`

## 2. Verification

- [x] 2.1 Verify workflow YAML is valid and all step references are correct
