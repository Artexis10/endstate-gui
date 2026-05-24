## 1. Bridge

- [x] 1.1 Add `backupClaim()` wrapper to `src/lib/backup-bridge.ts` invoking `endstate backup claim --token <t> --save-recovery-to <p>` with passphrase on stdin. Mirrors `backupSignup`. Reuses `BackupSignupData` (already carries `email` + optional `subscriptionStatus`); no new type.

## 2. Error mapping

- [x] 2.1 Extend `friendlyAuthError` in `src/components/app/auth/auth-errors.ts` with the four claim codes per spec (`CLAIM_TOKEN_INVALID`, `CLAIM_TOKEN_EXPIRED`, `CLAIM_TOKEN_CONSUMED`, `KDF_TOO_WEAK`).
- [x] 2.2 Add tests to `src/components/app/auth/auth-errors.test.ts` covering each of the four new codes and confirming the existing default branch is unchanged.

## 3. Sign-up form claim branch

- [x] 3.1 Add `claimMode` + `claimCode` state to `sign-up-form.tsx`. Wire the "Have a Hosted Backup claim code?" / "Use a regular sign-up instead" toggle links.
- [x] 3.2 Conditionally render the email input vs. the claim-code paste field based on `claimMode`. Preserve `passphrase` value across toggles.
- [x] 3.3 Export `normalizeClaimCode()`: trim whitespace, strip `endstate://claim?token=` prefix; validate against `/^[A-Za-z0-9_-]{43}$/`.
- [x] 3.4 Branch the submit handler on `claimMode`: invoke `backupClaim` instead of `backupSignup`. `onSignedUp(data)` upstream is unchanged.
- [x] 3.5 Update submit button label to "Claim account" / "Claiming account" when in claim mode, "Create account" / "Creating account" otherwise.
- [x] 3.6 Route the sign-up form's server-error display through `friendlyAuthError` (parity with sign-in-form) and render the optional CTA button.

## 4. Tests

- [x] 4.1 Create `src/components/app/auth/sign-up-form.test.tsx` covering: default form, toggle into claim mode (email hidden, paste field visible, password preserved), toggle back out (email restored), submit disabled until token + password valid, submit invokes `backupClaim` with the normalised token.
- [x] 4.2 Add `normalizeClaimCode` unit tests: bare token, whitespace-wrapped, deep-link prefix, combined.
- [x] 4.3 Assert that `CLAIM_TOKEN_INVALID` surfaces the friendly headline + remediation with no CTA, and that `CLAIM_TOKEN_CONSUMED` renders a Sign-in CTA that calls `onSwitchTab('sign-in')`.

## 5. Verify

- [x] 5.1 Run `npx vitest run src/components/app/auth/` — all new and existing auth tests pass (25/25).
- [x] 5.2 Run `npx tsc --noEmit` — no type errors.
- [x] 5.3 Run `openspec validate add-hosted-backup-claim-input --strict` — passes.
- [x] 5.4 Run full unit suite — `npx vitest run` reports 1250 passed, 2 skipped, 0 failed.
- [ ] 5.5 Manually verify in `npm run tauri dev` (once engine PR has shipped): paste a valid claim code, complete the recovery-key dialog, land on the backup pane signed in. Confirm `CLAIM_TOKEN_INVALID`/`CONSUMED` paths render friendly errors.
