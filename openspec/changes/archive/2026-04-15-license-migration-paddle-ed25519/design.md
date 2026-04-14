## Context

The GUI currently gates access behind a LemonSqueezy license key. `src-tauri/src/license.rs` calls LemonSqueezy's `/v1/licenses/activate`, `/v1/licenses/validate`, and `/v1/licenses/deactivate` endpoints, caches activation in `%APPDATA%/Endstate/license.json`, and trusts that cache whenever the network is unreachable (blind offline grace).

We are replacing the checkout flow with Paddle and hosting our own license service at `https://substratesystems.io/api/license/*` (Vercel). On Paddle purchase, the Vercel API generates a license key that is an Ed25519-signed payload encoding the customer/order metadata. Our API signs activation responses with the same Ed25519 key; the GUI embeds the corresponding public key and verifies every activation response before trusting it — including when trusting the cache offline.

Constraints:
- The existing `LicenseGate` UX (activation screen, loading spinner, deactivation from settings, `VITE_DEV_BYPASS_LICENSE`) must continue to work unchanged in shape.
- Machine fingerprint derivation must not change; it is still the identity tied server-side to the activation slot.
- 3-device activation limit is enforced server-side; the client is not the source of truth for slot counting.
- We must not call LemonSqueezy at runtime after this change ships.

Stakeholders: end users (re-activation required once), payments/ops (Paddle + Vercel API), engineering (client and server changes).

## Goals / Non-Goals

**Goals:**
- Move all license network traffic to `https://substratesystems.io/api/license/*`.
- Cryptographically verify activation responses and cached activations using an embedded Ed25519 public key.
- Preserve the user-visible `LicenseGate` flow and the per-machine fingerprint behavior.
- Deliver a clean removal of LemonSqueezy-specific code, types, and copy.

**Non-Goals:**
- Designing the Vercel/Paddle backend — it is assumed to exist and expose the endpoints below.
- Migrating or honoring existing LemonSqueezy keys on the new server (users re-activate with a newly issued key).
- Supporting multiple license providers side-by-side; this is a full replacement.
- Changing the machine fingerprint algorithm.
- Implementing key rotation for the embedded Ed25519 public key (tracked as an open question).

## Decisions

### Decision: Use Ed25519 with `ed25519-dalek` for signature verification
Ed25519 gives us small signatures (64 bytes), small public keys (32 bytes), deterministic verification, and a mature Rust implementation (`ed25519-dalek`). The alternative, RSA, produces much larger signatures and public keys with no security benefit at this scale. ECDSA-P256 was also considered; its ecosystem support is fine but Ed25519 is simpler (no nonce generation concern, no ASN.1 encoding quirks) and is the default in most modern signing tooling. We will use `ed25519-dalek` v2 with `VerifyingKey::verify_strict` to reject non-canonical signatures.

### Decision: Embed the public key as a `const` byte array in Rust, compiled into the binary
The 32-byte public key is checked into `src-tauri/src/license_pubkey.rs` as `pub const LICENSE_PUBLIC_KEY: [u8; 32] = [...]`. Compiling it in avoids any file-loading or environment-variable failure modes at runtime, makes it impossible to override at runtime (a binary-resident constant cannot be swapped by an attacker without re-signing the app), and keeps the build reproducible. Alternative: load from `include_bytes!("license_public.pem")`. Rejected because PEM introduces a parser and buys nothing for a single 32-byte key.

### Decision: Canonical signing payload is `sha256(license_key || fingerprint || activated_at || expires_at)`
The server signs a fixed canonical byte string derived from the four fields it wants to bind. The client reconstructs the same string from cache fields and verifies the signature against the embedded public key. We hash before signing so the payload length is bounded regardless of license key length. `activated_at` and `expires_at` are UTC RFC3339 strings; concatenation order is fixed and documented in both repos. Alternative: JWT (EdDSA). Rejected because we control both sides and don't need the JWT envelope; a fixed binary layout avoids JSON canonicalization ambiguity.

### Decision: Offline trust requires a valid signature; online re-validation is required every 30 days
On every `check_license`, the client:
1. Reads the cache.
2. Recomputes the expected signature payload and verifies the signature against the embedded public key. Invalid signature → cache is deleted, user is deactivated.
3. Verifies the fingerprint matches the current machine.
4. If `now - activated_at < 30 days` **or** `now < expires_at - 30 days`, trusts the cache even if the API is unreachable.
5. If the 30-day window has elapsed, the client attempts an online `/validate` call. On success, the cache's `activated_at` is refreshed (via a new signed response). On network failure after the window, the license is treated as inactive with `validationError: "License must be re-validated online"`.

This trades some user-facing friction (30-day enforced online touch) for revocation latency bounded by 30 days. Alternative: pure perpetual offline trust with only server-side revocation at next online connect. Rejected because it gives revoked keys unbounded offline life.

### Decision: Server-side device-limit enforcement, client just surfaces the error
The client never counts slots. If the user attempts activation on a 4th device, the API returns an error (e.g., `{ error: "device_limit_reached", message: "License is already active on 3 devices..." }`). The `LicenseGate` activation UI displays the message verbatim in the error slot. This keeps slot accounting authoritative on the server and makes client logic simpler.

### Decision: Cache schema extension is additive
The cache file gains three new fields: `signature` (base64 Ed25519 signature), `expiresAt` (RFC3339 string or `null` for non-expiring), and `lastValidatedAt` (RFC3339 string). Existing fields (`key`, `instanceId`, `fingerprint`, `activatedAt`) remain. A cache written by the pre-migration binary lacks `signature`; the post-migration binary treats a missing/invalid signature as a hard failure → cache deleted, user forced to re-activate. This is acceptable because every user must re-activate anyway (LemonSqueezy keys don't exist on the new server).

### Decision: API endpoints and wire format
Base URL: `https://substratesystems.io/api/license`. Endpoints:
- `POST /activate` — body `{ licenseKey, fingerprint }`. Response `{ activated: true, instanceId, activatedAt, expiresAt, signature }` on success, `{ activated: false, error, message }` on failure.
- `POST /validate` — body `{ licenseKey, fingerprint, instanceId }`. Response `{ valid: true, activatedAt, expiresAt, signature }` or `{ valid: false, error, message }`.
- `POST /deactivate` — body `{ licenseKey, instanceId }`. Response `{ deactivated: true }` or error.

The server signs `sha256(licenseKey || fingerprint || activatedAt || expiresAt)` on activate and re-validate responses. Deactivate responses are not signed (no trusted state flows from them to the cache).

## Risks / Trade-offs

- [Public key compromise would allow forged activations offline] → Mitigation: private key held only in the Vercel environment (not in the repo, not in CI artifacts that ship to users); rotation is a future capability (see Open Questions). Treat `src-tauri/src/license_pubkey.rs` as a protected file.
- [30-day online re-validation requirement may frustrate truly-offline users (air-gapped labs)] → Mitigation: the 30-day window is generous; the error message directs users to re-validate when they next have connectivity. If this proves problematic we can extend the window via a subsequent change.
- [Existing LemonSqueezy customers lose access until re-issued a new key] → Mitigation: coordinated migration — customer-ops issues new keys before the release ships; the activation screen surfaces the `device_limit_reached` and generic error messages so re-activation is self-service.
- [Cache file corruption or clock skew could wedge users] → Mitigation: any signature/fingerprint failure deletes the cache and returns the user to the activation screen — a known-recoverable state. Clock skew up to several hours is absorbed by the 30-day window.
- [`ed25519-dalek` version drift vs. server signing library] → Mitigation: document the canonical signing payload format and test with known-answer vectors shared between the GUI repo and the Vercel API repo.

## Migration Plan

1. **Server-side prereqs** (out of scope for this change but gate the rollout): Vercel API live at `substratesystems.io/api/license/*`; Paddle checkout issuing Ed25519 keys; re-issuance process for existing customers.
2. **Client change** (this change):
   a. Add `ed25519-dalek` + `base64` deps, embed public key constant.
   b. Replace HTTP client module in `license.rs` with new endpoints + request/response types.
   c. Extend cache schema; on read, reject any cache without a valid signature.
   d. Update `LicenseGate.tsx` checkout URL to Paddle URL.
   e. Update Rust + frontend tests (including signature verification round-trip using a test keypair).
3. **Rollback**: revert the GUI release. The pre-migration binary still points at LemonSqueezy and will continue to work for users who have LemonSqueezy-valid keys. Users who already re-activated on the new binary will need to re-activate again against LemonSqueezy if rolled back — document this as a one-way migration in release notes.
4. **Release notes**: explicitly call out the one-time re-activation requirement and link to the key re-issuance flow.

## Open Questions

- Do we want a key-rotation story now (e.g., support a list of trusted public keys with an `active` flag) or defer? Leaning defer — single-key is simpler and rotation can be a targeted future change once we have telemetry on signature-failure rates.
- Should `lastValidatedAt` be exposed in the UI (e.g., "License last validated 12 days ago" in settings) or kept internal? Leaning internal for now.
- How do we handle a legitimate `expiresAt` reaching zero for subscription-based licenses? Assumed out of scope; current Paddle plan is perpetual. If subscriptions ship later, that is a separate change.
