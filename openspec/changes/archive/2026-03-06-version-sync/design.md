## Context

The GUI distributes its version across three files that must stay in sync:
- `package.json` — npm/Node.js version (source of truth)
- `src-tauri/tauri.conf.json` — Tauri app version
- `src-tauri/Cargo.toml` — Rust crate version

Additionally, the GUI declares engine schema compatibility in `src/lib/compat.ts` as a typed constant (`ENGINE_SCHEMA_COMPAT`). This value is used at runtime to validate the engine's schema version.

Manual edits to any of these files risk version drift that silently breaks builds or causes runtime mismatches.

## Goals / Non-Goals

**Goals:**
- Enforce version consistency across all three files via automated pre-push validation
- Provide a single-command bump script that atomically updates all files, changelog, and creates a git commit + tag
- Declare engine schema compatibility in typed code (`compat.ts`)
- Support dry-run mode for previewing bump operations

**Non-Goals:**
- CI/CD release pipeline (future work)
- Automatic version detection from git tags
- Engine-side schema version validation (engine repo concern)

## Decisions

### Decision 1: `package.json` is the version source of truth
**Rationale**: npm ecosystem conventions; `readVersion()` always reads from `package.json`. Other files are kept in sync by the bump script.
**Alternative**: Use a dedicated `VERSION` file — rejected because it adds a fourth file and breaks npm conventions.

### Decision 2: Pre-push hook (not pre-commit)
**Rationale**: Version sync validation runs on push, not commit, to avoid blocking WIP commits during development. Developers may intentionally have temporary mismatches during active work.
**Alternative**: Pre-commit hook — rejected as too noisy for iterative development.

### Decision 3: Node.js scripts (not shell scripts)
**Rationale**: Cross-platform (Windows + macOS + Linux). The project already uses Node.js. Regex-based Cargo.toml editing is simple enough to avoid a TOML parser dependency.
**Alternative**: Shell scripts — rejected for Windows compatibility. TOML parser — rejected as unnecessary dependency for a single regex replacement.

### Decision 4: `gui-v` tag prefix
**Rationale**: Distinguishes GUI releases from engine releases in a potentially shared tag namespace. Format: `gui-v0.1.1`.

### Decision 5: Schema compat uses `MAJOR.MINOR` format
**Rationale**: Patch versions don't affect schema compatibility. The `min`/`max` range allows the GUI to declare support for multiple engine schema generations.

## Risks / Trade-offs

- **[Cargo.toml regex fragility]** → The regex `^version\s*=\s*"[^"]*"` assumes the first `version` key is the package version. Mitigated by Cargo.toml structure conventions (package section comes first).
- **[CHANGELOG.md marker dependency]** → The bump script looks for `## [` to find the insertion point. If the changelog format drifts, the script will fail. Mitigated by the script exiting with an error rather than corrupting the file.
- **[Emergency bypass absent]** → Unlike openspec validation, version-sync has no `BYPASS` env var. This is intentional — version drift should always be fixed before push.
