# OpenSpec Enforcement Runbook

This document describes OpenSpec enforcement for endstate-gui.

---

## Overview

**OpenSpec** is the canonical behavior specification system. All behavior changes MUST be represented as OpenSpec changes.

This repository enforces **Level 2: Workflow Gate** - a pre-push hook blocks pushes when OpenSpec validation fails.

---

## Enforcement Levels Reference

| Level | Name | Mechanism |
|-------|------|-----------|
| 0 | Policy-only | Documentation states requirement |
| 1 | Advisory | CI warns on missing specs |
| **2** | **Workflow gate** | **Pre-push hook blocks invalid changes** |
| 3 | Strict coupling | CI fails, merge blocked |

---

## Setup

### Install Hooks

After cloning or pulling, install git hooks:

```bash
npm run hooks:install
```

This uses lefthook (tracked in `lefthook.yml`) to install the pre-push hook.

### Dependency

OpenSpec CLI is pinned as a dev dependency:

```json
"@fission-ai/openspec": "~0.19.0"
```

The validation scripts use the repo-local binary via npm scripts (no npx).

---

## Validation Commands

| Command | Purpose |
|---------|---------|
| `npm run openspec:list` | List all OpenSpec items |
| `npm run openspec:list:specs` | List specs only |
| `npm run openspec:validate` | Validate all specs (strict mode) |
| `npm run openspec:validate:ci` | CI-ready validation via PowerShell script |

---

## Pre-Push Hook Behavior

When you run `git push`:

1. Lefthook triggers `scripts/openspec_validate.ps1`
2. Script checks for `OPENSPEC_BYPASS` environment variable
3. If bypass not set, runs `npm run -s openspec:validate`
4. Push proceeds only if validation passes

### On Failure

```
OpenSpec validation failed. Fix errors or set OPENSPEC_BYPASS=1 for emergency bypass.
```

Fix the validation errors before pushing.

---

## Emergency Bypass

For non-behavior changes only (documentation, formatting, etc.):

```bash
# PowerShell
$env:OPENSPEC_BYPASS=1; git push

# Bash
OPENSPEC_BYPASS=1 git push
```

**Warning:** Bypass is logged. Use sparingly and only for genuine non-behavior changes.

---

## OpenSpec Structure

```
openspec/
  project.md          # Project-level OpenSpec configuration
  specs/              # Behavior specifications
  changes/            # Change records
```

---

## Troubleshooting

### Hook Not Running

Ensure hooks are installed:

```bash
npm run hooks:install
```

### Validation Fails Unexpectedly

Run validation manually to see detailed output:

```bash
npm run openspec:validate
```

### Need to Skip for Emergency

Use bypass (see above), but document why in your commit message.

---

## References

- `docs/ai/AI_CONTRACT.md` - OpenSpec enforcement levels and policy
- `docs/ai/PROJECT_RULES.md` - Operational enforcement details
- `lefthook.yml` - Hook configuration (tracked)
