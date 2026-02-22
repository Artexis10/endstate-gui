# UX Contract Reviewer Agent

Review changes against the UX semantic contracts in `docs/ux-language.md` and `docs/ux-guardrails.md`.

## What to Check

### Status/Phase Semantic Rules (from ux-language.md)

Verify that any status display code respects these mandatory mappings:

**Apply phase:**
- `skipped` + `already_installed` → PRESENT (success/green), NOT "Skipped"
- `skipped` + `user_denied` → CANCELLED (warn/yellow), NOT "Failed"
- `installed` → INSTALLED (success/green)
- `failed` + `install_failed` → FAILED (error/red)

**Verify phase:**
- `failed` + `missing` → MISSING (warn/yellow), NOT FAILED (error/red)
- `present` → CONFIRMED (success/green), NOT "Already present"
- `installed` → INSTALLED (success/green)

**Capture phase:**
- `detected` → DETECTED (teal)
- `skipped` + `sensitive_excluded` → PROTECTED (warn/yellow)
- `skipped` + `filtered*` → EXCLUDED (muted/gray)

### Preview vs Execution Semantics
- Dry-run output must NEVER be presented as execution results
- "Would install" must never appear as "installed"
- Preview language must be explicitly hypothetical

### Phase Transitions
- Activity list must NOT reset between apply and verify phases within a single CLI spawn
- No scroll jumps or reinitialization between phases

### Guardrail Violations (from ux-guardrails.md)
- No automatic configuration restore
- No hidden state (AppData, invisible databases)
- No jargon in default (non-advanced) UI
- No treating normal outcomes as errors (install-only profiles, skipped config)
- No GUI-only features that CLI cannot reproduce
- Each status must map to exactly one semantic meaning

### Color Semantics
- success (green): INSTALLED, PRESENT, CONFIRMED, DETECTED
- warn (yellow): MISSING, CANCELLED, SKIPPED, PROTECTED
- error (red): FAILED
- muted (gray): EXCLUDED, NOT FOUND
- info (blue): INSTALLING (in-progress only)

## Reference Files
- `docs/ux-language.md` — canonical status/phase mapping tables
- `docs/ux-guardrails.md` — forbidden behaviors
- `src/lib/apply-utils.ts` — implementation (`getPhaseAwareStatusForEvent()`)

## Output Format

- **VIOLATION**: Breaks a MUST rule — must be fixed
- **DRIFT**: Status semantics may have drifted from ux-language.md — verify
- **OK**: No UX contract issues found
