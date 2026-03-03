## Why

The GUI is a commercial product (€39 lifetime, 3 device activations). It needs a license gate that blocks unlicensed users from the app while supporting offline use and machine-bound activation via LemonSqueezy.

## What Changes

- Rust backend module (`license.rs`) for machine fingerprinting (MachineGuid + hostname + InstallDate → SHA-256), LemonSqueezy API integration (activate/validate/deactivate), and disk cache at `%APPDATA%/Endstate/license.json` with offline grace
- Three Tauri async commands (`activate_license`, `check_license`, `deactivate_license`) wired into invoke handler
- Frontend bridge (`license.ts`) with typed wrappers around Tauri invoke calls
- `LicenseGate` React component wrapping the entire app — checks license on mount, renders activation screen or children, provides context for settings deactivation
- Dev bypass via `VITE_DEV_BYPASS_LICENSE=1`

## Capabilities

### New Capabilities

- `license-gate`: Blocks the entire app behind license activation. Validates on startup, supports offline grace via cached validation, dev bypass for development builds.

### Modified Capabilities

_(none)_

## Impact

- `src-tauri/src/license.rs` — New: machine fingerprint, LemonSqueezy API calls, cache persistence, `LicenseStatus`/`LicenseCache` types, 6 unit tests
- `src-tauri/src/lib.rs` — Modified: module declaration, three async Tauri commands, invoke handler registration
- `src/lib/license.ts` — New: typed frontend bridge (`activateLicense`, `checkLicense`, `deactivateLicense`)
- `src/components/app/LicenseGate.tsx` — New: gate component, activation UI, `LicenseGateContext` provider, `useLicenseGate` hook, dev bypass
- `src/components/app/LicenseGate.test.tsx` — New: component tests
- `src/App.tsx` — Modified: imports `LicenseGate` and `useLicenseGate`, wraps app, `LicenseSettingsSection` for deactivation
