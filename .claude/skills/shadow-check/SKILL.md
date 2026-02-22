---
name: shadow-check
description: Review changes and determine if PROJECT_SHADOW.md needs updating per AI_CONTRACT.md criteria. Runs automatically during code review.
user-invocable: false
---

After completing a code change, review whether `docs/ai/PROJECT_SHADOW.md` needs updating.

**Trigger**: Run this check after any non-trivial code change is complete.

**Steps**

1. **Identify what changed** — review the files modified in this session
2. **Check against Shadow update criteria** from `docs/ai/AI_CONTRACT.md`:

   A Shadow update is needed when changes affect:
   - **Core invariants** — rules that must never be violated
   - **Architecture or subsystem boundaries** — new modules, removed components, restructured directories
   - **Contracts or public APIs** — interface changes, new integration points
   - **Landmines or sharp edges** — newly discovered non-obvious failure modes
   - **Explicit non-goals** — scope boundaries added or removed
   - **Testing philosophy** — strategy changes (not individual test additions)
   - **Development workflow assumptions** — build process, environment requirements

3. **Do NOT flag** for:
   - Bug fixes within existing architecture
   - Documentation updates
   - Dependency version bumps
   - Test additions that follow existing strategy
   - Performance optimizations that preserve contracts

4. **If update needed**: Propose a minimal, patch-style update to PROJECT_SHADOW.md describing only the divergence. Do not rewrite unchanged sections.

5. **If no update needed**: Say nothing — do not mention this check unless it finds something.

**Output** (only when update is warranted)

```
## Shadow Update Recommended

**Reason**: [which criteria triggered]
**Section affected**: [PROJECT_SHADOW.md section number]
**Proposed change**: [minimal patch description]
```
