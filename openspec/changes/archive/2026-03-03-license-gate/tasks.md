## Tasks

All tasks are retroactive — implementation is complete.

### Task 1: Rust license module
**File**: `src-tauri/src/license.rs`
- [x] Machine fingerprint: read `MachineGuid` + hostname + `InstallDate` from registry, concatenate, SHA-256 hash to 64-char hex
- [x] `LicenseStatus` type: `activated: bool`, `validationError: Option<String>`
- [x] `LicenseCache` type: `key`, `instanceId`, `fingerprint`, `activatedAt` (camelCase serialization)
- [x] `activate()`: POST to LemonSqueezy `/v1/licenses/activate`, write cache on success
- [x] `check()`: read cache, verify fingerprint, validate online, offline grace fallback
- [x] `deactivate()`: POST to LemonSqueezy `/v1/licenses/deactivate`, delete cache
- [x] Cache path: `%APPDATA%/Endstate/license.json`, create parent dirs on write
- [x] 6 unit tests: serialization, inactive constructors, cache roundtrip, fingerprint determinism

### Task 2: Tauri command registration
**File**: `src-tauri/src/lib.rs`
- [x] Add `mod license` declaration
- [x] Add `activate_license(key: String) -> Result<LicenseStatus, String>` async command
- [x] Add `check_license() -> Result<LicenseStatus, String>` async command
- [x] Add `deactivate_license() -> Result<(), String>` async command
- [x] Register all three in `invoke_handler`

### Task 3: Frontend bridge
**File**: `src/lib/license.ts`
- [x] `activateLicense(key: string)` — invokes `activate_license`
- [x] `checkLicense()` — invokes `check_license`
- [x] `deactivateLicense()` — invokes `deactivate_license`
- [x] `LicenseStatus` TypeScript type matching Rust struct

### Task 4: LicenseGate component
**File**: `src/components/app/LicenseGate.tsx`
- [x] Gate component with three states: checking (spinner), unlicensed (activation card), licensed (render children)
- [x] Activation card: key input, activate button, "Buy Endstate" link
- [x] Error display below key input on failed activation
- [x] `LicenseGateContext` with status and `onDeactivated` callback
- [x] `useLicenseGate()` hook for consuming context
- [x] Dev bypass: if `VITE_DEV_BYPASS_LICENSE === '1'`, render children immediately

### Task 5: App integration
**File**: `src/App.tsx`
- [x] Import `LicenseGate` and `useLicenseGate`
- [x] Wrap app content with `<LicenseGate>`
- [x] `LicenseSettingsSection`: display masked key, deactivation dialog with confirmation
- [x] Deactivation calls `deactivateLicense()` then `onDeactivated` to reset gate

### Task 6: Tests
- [x] `src-tauri/src/license.rs` — 6 Rust unit tests (serialization, inactive constructors, cache roundtrip, fingerprint determinism)
- [x] `src/components/app/LicenseGate.test.tsx` — Component tests for gate behavior
