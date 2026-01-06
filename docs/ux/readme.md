# UX Architecture (Frozen)

Status: FROZEN (v1)

These documents define Endstate UX intent (contracts + interaction maps).
They are not implementation notes.

Change policy:
- Do not edit these files as part of feature work.
- If UX intent changes, update these docs in a dedicated commit with an explicit reason.
- PRs that change UI behavior must be checked against UX_PR_CHECKLIST.md.

## UX Architecture

Endstate UX is defined by:
1. UX contracts (`UX_CONTRACTS.md`)
2. Surface-specific interaction maps

Implementation, styling, and components MUST conform to these documents.
If a UI change violates a contract, the contract must be explicitly revised.
