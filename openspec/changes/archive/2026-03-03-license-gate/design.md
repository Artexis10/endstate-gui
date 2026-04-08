## Approach

Three-layer architecture: Rust backend (fingerprint + API + cache), Tauri commands as bridge, React gate component as UI surface. The gate wraps the entire app at the top level in `App.tsx`.

## Data Flow

```
Startup
  → LicenseGate mounts
  → checkLicense() Tauri invoke
  → Rust: read %APPDATA%/Endstate/license.json
  → Rust: verify fingerprint matches current machine
  → Rust: call checkout provider /v1/licenses/validate
    → API reachable + valid: return activated=true
    → API reachable + invalid: delete cache, return activated=false
    → API unreachable: trust cache (offline grace), return activated=true
  → Frontend: LicenseStatus { activated, validationError? }
  → Gate renders app (activated) or activation screen (not activated)
```

```
Activation
  → User enters key → clicks Activate
  → activateLicense(key) Tauri invoke
  → Rust: compute machine fingerprint
  → Rust: POST /v1/licenses/activate { key, instance_name: fingerprint }
  → Success: write cache to disk, return activated=true
  → Failure: return activated=false + validationError
  → Gate re-renders
```

```
Deactivation (from settings)
  → onDeactivated callback from LicenseGateContext
  → deactivateLicense() Tauri invoke
  → Rust: POST /v1/licenses/deactivate { key, instance_id }
  → Delete cache from disk
  → Gate resets to activation screen (key cleared, error cleared)
```

## Key Decisions

1. **Fingerprint uses three stable values** — `MachineGuid` (per-install), hostname (user-visible), `InstallDate` (adds entropy). Concatenated and SHA-256 hashed to a 64-char hex string.
2. **Offline grace trusts cache unconditionally** — When the checkout provider API is unreachable, the cached validation is trusted with no expiry timer.
3. **Cache is plain JSON in APPDATA** — Not encrypted. License keys are not secrets; they're tied to machine fingerprint and worthless on a different machine.
4. **Dev bypass is build-time** — `VITE_DEV_BYPASS_LICENSE=1` is a Vite env var checked at build time, not a runtime toggle. Gate renders children immediately without calling Rust.
5. **Gate resets fully on deactivation** — Clears key input, error state, and status. User sees the activation screen as if fresh.

## Files Changed

| File | Change |
|------|--------|
| `src-tauri/src/license.rs` | New: machine fingerprint (SHA-256), checkout provider API (activate/validate/deactivate), disk cache at `%APPDATA%/Endstate/license.json`, `LicenseStatus`/`LicenseCache` types, 6 unit tests |
| `src-tauri/src/lib.rs` | Modified: `mod license` declaration, three async commands (`activate_license`, `check_license`, `deactivate_license`), invoke handler registration |
| `src/lib/license.ts` | New: typed wrappers — `activateLicense(key)`, `checkLicense()`, `deactivateLicense()` calling Tauri invoke |
| `src/components/app/LicenseGate.tsx` | New: gate component with checking/activation/licensed states, `LicenseGateContext` provider, `useLicenseGate` hook, dev bypass check |
| `src/components/app/LicenseGate.test.tsx` | New: component tests for gate behavior |
| `src/App.tsx` | Modified: imports `LicenseGate`/`useLicenseGate`, wraps app in `<LicenseGate>`, `LicenseSettingsSection` with deactivation dialog |
