## 1. Dependencies and embedded key

- [x] 1.1 Add `ed25519-dalek = "2"` and `base64` (if absent) to `src-tauri/Cargo.toml`
- [x] 1.2 Create `src-tauri/src/license_pubkey.rs` exposing `pub const LICENSE_PUBLIC_KEY: [u8; 32]` with the production public key
- [x] 1.3 Add `license_pubkey` to `src-tauri/src/lib.rs` module list and mark the file as protected in `docs/ai/PROJECT_RULES.md`

## 2. Signing primitives

- [x] 2.1 Add a `verify_activation_signature(license_key, fingerprint, activated_at, expires_at, signature_b64)` helper that computes `sha256(license_key || fingerprint || activated_at || expires_at)` and verifies the decoded signature with `VerifyingKey::verify_strict` against `LICENSE_PUBLIC_KEY`
- [x] 2.2 Document the canonical byte layout in a Rust doc-comment and mirror it in `../substrate-systems-api` repo docs
- [x] 2.3 Add known-answer-vector tests (valid, tampered payload, tampered signature, wrong key) using a test keypair injected via a `#[cfg(test)]` override of the pubkey

## 3. Cache schema extension

- [x] 3.1 Add `expiresAt: Option<String>`, `signature: String`, `lastValidatedAt: String` fields to the `LicenseCache` struct with `serde(rename_all = "camelCase")`
- [x] 3.2 Update cache read path to (a) parse the new fields, (b) call `verify_activation_signature`, (c) delete the cache and return inactive on any signature failure
- [x] 3.3 Update cache write path to persist all seven fields atomically
- [x] 3.4 Add a Rust test that a cache without a `signature` field is rejected and deleted

## 4. Replace LemonSqueezy client with substratesystems.io client

- [x] 4.1 Remove the existing LemonSqueezy HTTP module, types, and URL constants from `src-tauri/src/license.rs`
- [x] 4.2 Add a `const LICENSE_API_BASE: &str = "https://substratesystems.io/api/license"` and request/response types for `/activate`, `/validate`, `/deactivate`
- [x] 4.3 Implement `activate_license` to POST to `/activate`, verify the response signature, and persist the cache on success
- [x] 4.4 Implement `check_license` per the spec: signature check → fingerprint check → 30-day window logic (online re-validate when stale, trust cache when fresh and offline, force re-validation error when stale and offline)
- [x] 4.5 Implement `deactivate_license` to POST to `/deactivate` with `{ licenseKey, instanceId }`
- [x] 4.6 Ensure every error path surfaces the server's `message` verbatim (including `device_limit_reached`)

## 5. Rust tests

- [x] 5.1 Unit test: successful activation persists cache with all seven fields
- [x] 5.2 Unit test: activation with bad signature returns `validationError` and writes no cache
- [x] 5.3 Unit test: `check_license` with `lastValidatedAt` < 30 days and unreachable API returns active
- [x] 5.4 Unit test: `check_license` with `lastValidatedAt` >= 30 days and unreachable API returns inactive with "must be re-validated online" and preserves the cache
- [x] 5.5 Unit test: `check_license` online re-validation success updates `lastValidatedAt` and re-signs
- [x] 5.6 Unit test: `check_license` online re-validation returning `valid: false` deletes the cache
- [x] 5.7 Unit test: fingerprint mismatch returns the expected error without deleting the cache
- [x] 5.8 Unit test: deactivation with no cache returns "No active license to deactivate"
- [x] 5.9 Re-verify existing fingerprint determinism and serialization tests still pass

## 6. Frontend changes

- [x] 6.1 Update the "Buy Endstate" link in `src/components/app/LicenseGate.tsx` to the Paddle checkout URL
- [x] 6.2 Audit `src/lib/license.ts` types; adjust `LicenseStatus` fields only if the Rust bridge types actually changed shape
- [x] 6.3 Update copy anywhere that says "checkout provider" or references LemonSqueezy to be provider-neutral
- [x] 6.4 Update `src/components/app/LicenseGate.test.tsx` for the new checkout URL and any new error paths (e.g., device-limit message surfacing)

## 7. Migration and cleanup

- [x] 7.1 Grep the repo for `lemonsqueezy`, `LEMONSQUEEZY`, `api.checkout.example.com`, and similar tokens; remove or replace each hit
- [x] 7.2 Delete any LemonSqueezy-specific test fixtures and snapshot data
- [x] 7.3 Add release-notes entry in the relevant changelog/docs surface explaining the one-time re-activation requirement
- [x] 7.4 Update `docs/ai/PROJECT_RULES.md` Protected Files list to include `src-tauri/src/license_pubkey.rs` and the new `license.rs` structure

## 8. Validation

- [x] 8.1 `cd src-tauri && cargo test` passes
- [x] 8.2 `npx tsc --noEmit` passes
- [x] 8.3 `npx vitest run src/components/app/LicenseGate.test.tsx` passes
- [ ] 8.4 Manual smoke: `npm run tauri dev` → activate with a test key against a staging `substratesystems.io` deployment, deactivate, re-activate, unplug network and confirm offline-within-window behavior
- [x] 8.5 `npm run openspec:validate --all --strict --no-interactive` passes
