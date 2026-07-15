## 1. Contract and parser

- [x] 1.1 Add failing unit tests for the exact `endstate://claim` URL contract.
- [x] 1.2 Implement the pure parser and token-safe claim intent type.

## 2. Native launch wiring

- [x] 2.1 Add official Tauri deep-link and single-instance dependencies and
  static `endstate` scheme configuration.
- [x] 2.2 Register single-instance first, focus/restore `main`, then register
  deep-link.
- [x] 2.3 Add best-effort packaged Windows/Linux startup registration for the
  `endstate` scheme so a normal release launch repairs missing OS integration
  without letting debug builds replace the installed handler.
- [x] 2.4 Add frontend cold-start and warm-event handling with focused tests.

## 3. Streamlined claim UI

- [x] 3.1 Add failing tests for prefilled `Finish account setup` mode.
- [x] 3.2 Route valid links to claim setup and remount it for each warm intent.
- [x] 3.3 Add failing tests and implementation for the visible
  `Use purchase code` fallback.
- [x] 3.4 Add signed-in collision confirmation without persisting the token.

## 4. Substrate integration consumer

- [x] 4.1 Add failing email/page tests for exact app wording and fallback
  behavior.
- [x] 4.2 Update the claim page to copy best-effort before native launch and
  show clear launch/download/manual fallbacks.
- [x] 4.3 Update email instructions to match `Use purchase code` exactly.

## 5. Verification

- [ ] 5.1 Run focused Endstate unit tests, TypeScript/Vite build, Rust checks,
  and strict OpenSpec validation.
- [x] 5.2 Run focused Substrate tests, typecheck, lint for touched files, and
  production build.
- [ ] 5.3 Build/install Endstate on Windows and verify registry registration,
  cold launch, warm launch/focus, and token prefill.
- [x] 5.4 Run independent final review and resolve all critical/important
  findings.
