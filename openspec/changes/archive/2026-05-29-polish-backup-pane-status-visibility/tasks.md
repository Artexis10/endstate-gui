## 1. Shared utilities
- [x] 1.1 Add src/lib/quota-tone.ts + test
- [x] 1.2 Add src/lib/format-relative-time.ts + test
- [x] 1.3 Refactor src/components/app/backup/quota-meter.tsx to consume quotaTone (tests stay green)

## 2. Silent SWR focus refresh
- [x] 2.1 Add { silent?: boolean } arg + runIdRef + isReauthOpen prop in use-backup-state.ts
- [x] 2.2 Update focus effect call site
- [x] 2.3 Add four unit tests: silent-no-loading, silent-non-AUTH-silent, silent-AUTH-routes-when-dialog-closed, silent-AUTH-drops-when-dialog-open
- [x] 2.4 Wire isReauthOpen from App.tsx through backup-pane to the hook

## 3. Quota-near-limit notice
- [x] 3.1 Add quota-notice.tsx (inline BannerShell, role/aria-live, no CTA)
- [x] 3.2 Render <QuotaNotice> above <QuotaMeter> in backup-pane.tsx
- [x] 3.3 Delete src/lib/quota-warning-flag.ts + its test + the toast effect at backup-pane.tsx:130-154
- [x] 3.4 Add quota-notice.test.tsx (warn band, danger band, hidden when fields absent, clamping)

## 4. Last-sync indicator
- [x] 4.1 Add last-sync-indicator.tsx
- [x] 4.2 Render <LastSyncIndicator> below <QuotaMeter> in backup-pane.tsx
- [x] 4.3 Add last-sync-indicator.test.tsx with frozen-clock cases

## 5. E2E
- [x] 5.1 Add e2e/backup-quota-notice.spec.ts (≥50% warn, ≥90% danger, <50% absent)
- [x] 5.2 Extend an existing backup spec to assert data-testid="last-sync-indicator" presence

## 6. Validation
- [x] 6.1 npm run openspec:validate --all --strict --no-interactive passes
- [x] 6.2 npm run test:coverage meets thresholds (78L / 76S / 70F / 68B)
- [x] 6.3 npm run test:all passes
- [x] 6.4 Manual: npm run tauri dev, focus another window then return — no spinner flash
