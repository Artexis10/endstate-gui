# ADR-001: Intent-Based UX Redesign

**Status:** Accepted
**Date:** 2026-02-24
**Baseline Tag:** `ux/v0-baseline` (to be created before implementation begins)

## Context

The current GUI presents Save (capture) and Set up (apply) as coexisting features in a dashboard layout. This creates friction because the user's intent on any given machine is directional — they are either exporting state from this machine or importing state onto it. The dashboard model forces navigation of both concerns simultaneously.

Additionally, the current capture flow maintains in-GUI capture history and profile management on the Save side. This adds stateful complexity to what should be a simple, linear operation: scan machine, curate selection, produce portable artifact.

The portable artifact format (zip bundle containing manifest + config exports) is being promoted to first-class status, replacing folder-based sharing as the primary transfer mechanism.

## Decision

### 1. Binary intent landing screen

Replace the dashboard with a full-screen mode selector: **Save this computer** or **Set up this computer**. Each mode opens a dedicated full-viewport flow with transitions. Soft commitment — user can return to landing, but each flow is immersive.

### 2. Save flow: stateless guided capture

Save is a linear flow: capture → curate (select apps, toggle config per app) → produce zip → user saves to their chosen location. No in-GUI capture library. No capture history. The filesystem is the archive.

The existing capture management system is archived, not deleted. Code remains in git history for reference or reintroduction if needed (e.g., team/enterprise tier).

### 3. Set up flow: import + apply

Set up presents a drop zone (for zip or manifest import) alongside a list of existing profiles. Importing a zip unpacks it to `Documents/Endstate/Profiles/` where it becomes a normal profile. Profile management (rename, delete, inspect) lives here as contextual actions on profile cards.

Backward compatibility: manually placed folders and bare `.jsonc` files in the profiles directory are discovered and displayed alongside imported profiles.

### 4. Zip as first-class portable artifact

Zip bundles contain manifest + all config data needed for full machine reconstruction. Model A: zip is transport format. Engine operates on folders internally. Capture produces zips, import unpacks zips.

### 5. Archive capture management

The current in-GUI capture management surface (history, re-export, capture library) is removed from the active UX. Rationale:

- Save flow should be stateless and linear
- Filesystem replaces in-GUI capture library
- Complexity cost exceeds value for the target user
- Code is preserved in git for future reintroduction

## Consequences

### What changes

- Landing screen becomes binary mode selector
- Save flow becomes stateless guided capture → zip output
- Set up flow gains drop zone for zip/manifest import
- Capture management UI is removed
- Profile management moves into Set up flow
- Zip becomes the recommended portable format

### What stays

- Engine remains folder-based internally (Model A)
- CLI commands unchanged
- Profile contract unchanged
- Config portability contract unchanged
- UX guardrails and principles unchanged (safety, clarity, no hidden state)
- All engine invariants preserved

### What's archived

- In-GUI capture history / capture library
- Dashboard-style layout with coexisting Save/Set up

### Risks

- Users who want capture history lose in-GUI support (mitigated: filesystem serves this role)
- Zip engine commands don't exist yet (mitigated: manifest-only import works now, zip import added when engine supports it)

## Baseline Reference

Tag `ux/v0-baseline` on the commit immediately before implementation begins. This preserves the complete prior UX state for reference.

## Related Documents

- `docs/ux-principles.md` — unchanged, this redesign aligns with existing principles
- `docs/ux-guardrails.md` — unchanged, all guardrails respected
- `docs/config-export-restore-ux.md` — will need revision for zip-centric flows
- OpenSpec TBD — full behavioral specification for new flows
