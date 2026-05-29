## REMOVED Requirements

### Requirement: Machine fingerprint is deterministic and machine-bound
**Reason**: The fingerprint exists only to bind a license to a machine. With license activation removed, no machine binding is needed.
**Migration**: None. The Windows registry values are no longer read by the app; existing fingerprints in orphaned `license.json` cache files are ignored.

### Requirement: Activation calls checkout provider API
**Reason**: There is no checkout provider integration. Buy buttons have been removed from substratesystems.io and the product is free per PRINCIPLES.md.
**Migration**: None. Tauri commands `activate_license` and the `POST /api/license/activate` HTTP client are deleted; no replacement.

### Requirement: License cache persists to disk
**Reason**: With activation removed there is nothing to cache.
**Migration**: Existing cache files at `%APPDATA%\com.substratesystems.endstate\license.json` are orphaned but harmless and are not read by any code path. No deletion code is added.

### Requirement: License check validates signature, fingerprint, and re-validates periodically
**Reason**: PRINCIPLES.md: "Local features never check subscription status against any server." The 30-day re-validation window was the most direct violation.
**Migration**: None. Tauri command `check_license` deleted; the gate that called it on app mount is also removed.

### Requirement: Deactivation calls checkout provider API
**Reason**: No active licenses to deactivate; the deactivation Settings panel is removed.
**Migration**: None. Tauri command `deactivate_license` and the `POST /api/license/deactivate` HTTP client are deleted.

### Requirement: GUI gate blocks app when unlicensed
**Reason**: This requirement is the contradiction of PRINCIPLES.md being eliminated. The GUI MUST NOT block local features on subscription/license status.
**Migration**: `<LicenseGate>` removed from `src/App.tsx`. The app starts directly into the overview screen.

### Requirement: Dev bypass
**Reason**: The bypass existed to allow E2E tests and dev workflow to skip the gate. With the gate removed, the bypass has no subject.
**Migration**: `VITE_DEV_BYPASS_LICENSE` references removed from `playwright.config.ts`. No replacement env var is needed.
