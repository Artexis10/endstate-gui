## 1. Implementation

- [x] 1.1 In `LicenseGate.tsx` line 14: change `if (import.meta.env.VITE_DEV_BYPASS_LICENSE === '1')` to `if (import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_LICENSE === '1')`.
- [x] 1.2 Delete `.env.production` from the repository.

## 2. Verification

- [x] 2.1 Run `npm run test` — 880 passed, 2 skipped.
- [x] 2.2 Run `npm run openspec:validate` — 24/24 passed.
