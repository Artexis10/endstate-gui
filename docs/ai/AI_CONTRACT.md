# AI Development Contract

This document is the **single source of truth** for AI collaborator behavior in this repository.

This contract applies to all AI collaborators (e.g., Claude Code).

---

## Authority & Context

### Architecture Context

- Architecture context, commands, and landmines are in `CLAUDE.md` (auto-loaded by Claude Code)
- Invariants and behavior specifications are in `openspec/specs/` (lazy-loaded on demand)
- If architecture context appears outdated, propose a minimal update to `CLAUDE.md` via PR

### Decision Authority

- The human maintainer is the final decision-maker on architecture
- AI proposes; human disposes
- When intent is unclear, ask — do not assume

---

## Scope Discipline

- Make the **smallest change** that satisfies acceptance criteria
- No unrelated refactors
- No formatting sweeps
- No dependency bumps unless explicitly requested
- No opportunistic cleanups
- Stop once acceptance criteria and required verification are met

---

## Commit Message Convention

All commits MUST use [Conventional Commits](https://www.conventionalcommits.org/) format. This is enforced because the release pipeline (release-please) reads commit messages to determine semantic version bumps automatically.

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

| Type | Version bump | Description |
|------|-------------|-------------|
| `feat` | minor | New feature or capability |
| `fix` | patch | Bug fix |
| `perf` | patch | Performance improvement |
| `refactor` | none | Code change that neither fixes a bug nor adds a feature |
| `docs` | none | Documentation only |
| `test` | none | Adding or correcting tests |
| `chore` | none | Maintenance, dependencies, CI |
| `ci` | none | CI/CD changes |
| `style` | none | Formatting, whitespace |

### Breaking Changes

Breaking changes bump the major version (once past 1.0). Signal them with:
- `feat!:` or `fix!:` (type with `!`)
- `BREAKING CHANGE:` in the commit footer

### Rules

- Every commit to main MUST have a conventional prefix
- The description MUST be lowercase and imperative ("add feature" not "Added feature")
- Scope is optional but encouraged for multi-area repos (e.g., `feat(planner):`, `fix(capture):`)
- `chore:`, `docs:`, `ci:`, `style:`, `test:` do NOT trigger releases — use them for non-functional changes
- `feat:` and `fix:` ALWAYS trigger a release PR — do not use them for trivial changes unless a release is intended

---

## Contract & Change Safety

- **Preserve public APIs** and integration contracts unless explicitly changing them
- Prefer **contract-first edits**: schema/contract → implementation → tests
- Do not weaken security, authentication, or validation boundaries
- Do not remove error handling or defensive code without explicit instruction
- Do not collapse multi-step workflows into monolithic changes

---

## Verification Rules

- Run only the **minimum targeted verification** needed to confirm the change
- Do not run full test suites or full coverage unless explicitly requested
- If verification requires secrets, credentials, or external systems:
  - Do not guess or fabricate values
  - Ask for guidance or skip with explicit acknowledgment
- Provide copy-pastable verification commands when you cannot run them

---

## File-Write & Tool Restrictions

- Treat inability to write to files as a bug to work around
- Use a reliable fallback method (e.g., PowerShell `Set-Content` with leaf-path guard)
- **Never claim changes are applied** unless file contents are actually written and confirmed
- Do not create files outside the project directory without explicit permission

---

## Output Quality

- Prefer **concise, high-signal output**
- Avoid speculation and roadmap content
- Do not restate unchanged context
- Do not pad responses with filler or hedging

---

## OpenSpec: Behavior Change Contract

**OpenSpec is the canonical behavior specification system for this repository.**

Significant changes MUST be represented as OpenSpec changes. This includes behavior changes, licensing, dev workflow, tooling, infrastructure, and any decision that benefits from spec-driven documentation. OpenSpec provides:
- Machine-readable behavior specifications
- Change tracking and validation
- Enforcement at development workflow gates

### Enforcement Levels

| Level | Name | Mechanism | This Repo |
|-------|------|-----------|----------|
| 0 | Policy-only | Documentation states requirement | - |
| 1 | Advisory | CI warns on missing specs | - |
| **2** | **Workflow gate** | **Pre-push hook blocks invalid changes** | **Active** |
| 3 | Strict coupling | CI fails, merge blocked | - |

This repository enforces **Level 2**: local workflow gate via lefthook pre-push hook.

### Bypass

For emergency non-behavior changes only:
```bash
OPENSPEC_BYPASS=1 git push
```

Bypass is logged and should be used sparingly.

---

## Release Pipeline

This repository uses **release-please** for automated semantic versioning.

### How it works

1. Conventional commits land on main
2. release-please creates/updates a Release PR with version bump + CHANGELOG
3. Human maintainer merges the Release PR when ready to ship
4. release-please creates a git tag → GitHub Release workflow fires

### AI collaborator responsibilities

- Write conventional commit messages on every commit
- Use `feat:` for new features (triggers minor bump)
- Use `fix:` for bug fixes (triggers patch bump)
- Use `chore:`, `docs:`, `ci:` for non-release changes
- Do NOT manually edit version files (VERSION, package.json version) — release-please manages these
- Do NOT manually create git tags — release-please manages these
- Do NOT bump versions in commit messages unless explicitly instructed

### Manual version control

If the human maintainer instructs a manual version bump (e.g., to force a specific version), follow their instruction. Otherwise, leave versioning to the automated pipeline.

---

## Non-Goals

1. **Not a data migration tool** — Endstate does not migrate personal data, browser profiles, or credentials
2. **Not a personalization sync tool** — Endstate provisions machines; it does not sync preferences across devices
3. **No automatic configuration restore** — config restore requires explicit user opt-in per app
4. **No hidden internal state** — profiles are never stored in AppData or invisible locations
5. **No GUI-only features** — everything the GUI does must be reproducible via CLI
6. **No secrets handling** — browser profiles, auth tokens, password managers, and license blobs are intentionally unsupported
7. **No interactive preparation phase for manual apps** — deferred to v1.1

---

## Compliance

AI collaborators operating in this repository must:

1. Read and follow this contract
2. Represent significant changes as OpenSpec changes
3. Update CLAUDE.md when landmines or architecture context changes
4. Stop when acceptance criteria are met
5. Ask when uncertain rather than assume
6. Use conventional commit messages on every commit
