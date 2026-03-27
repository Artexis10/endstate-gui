---
trigger: always_on
---

# Windsurf Project Ruleset

This file configures Windsurf behavior for this repository.

**This is a thin adapter.** It delegates to the authoritative governance documents.

---

## Authority Hierarchy

Follow these documents in order of precedence:

1. `docs/ai/AI_CONTRACT.md` — AI behavior contract (highest authority)
2. `docs/ai/PROJECT_RULES.md` — operational policy
3. `CLAUDE.md` — architecture context, commands, landmines (auto-loaded by Claude Code)
4. `openspec/specs/` — invariants and behavior specifications (lazy-loaded on demand)

If any instruction in this file conflicts with the above, the higher-authority document wins.

---

## Contract Precedence

AI_CONTRACT.md > PROJECT_RULES.md > CLAUDE.md > this file

---

## Editing Guidance

| Change Type | Edit Location |
|-------------|---------------|
| AI behavior rules | `docs/ai/AI_CONTRACT.md` |
| Architecture, landmines | `CLAUDE.md` |
| Invariants, behavior specs | `openspec/specs/` |
| Env, build, test, storage policy | `docs/ai/PROJECT_RULES.md` |
| Windsurf-specific enforcement | This file |

---

## Windsurf Enforcement

### File Write Fallback

If file writes fail through normal tools:
1. Use PowerShell `Set-Content` as fallback
2. Verify writes completed before claiming success

```powershell
Set-Content -Path $path -Value $content -Force
```

### Verification Before Done

- Run minimum targeted verification to confirm changes
- Do not run full test suites unless explicitly requested
- Provide copy-pastable commands when you cannot run them

### Git Policy

Do not use `--no-verify` unless explicitly instructed by user.

---

## Quick Reference

### Key Paths

| Document | Purpose |
|----------|---------|
| `docs/ai/AI_CONTRACT.md` | AI behavior contract |
| `docs/ai/PROJECT_RULES.md` | Operational policy |
| `docs/ux-guardrails.md` | UX forbidden behaviors |
| `docs/ux-principles.md` | UX design principles |

### Test Commands

```bash
npm run test           # Unit tests
npm run test:e2e       # E2E tests
npm run test:coverage  # Coverage report
```

### Protected Areas

See `docs/ai/PROJECT_RULES.md` Section 2 for protected files requiring explicit instruction.
