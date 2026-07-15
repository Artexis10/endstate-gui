# Hosted Backup Claim Onboarding Implementation Plan

**Design:** `../specs/2026-07-15-hosted-backup-claim-onboarding-design.md`
**OpenSpec:** `../../../openspec/changes/add-hosted-backup-claim-deep-link/`

## Global Constraints

- Keep the email CTA HTTPS; only the verified web page launches the custom URL.
- Accept only `endstate://claim?token=<43 base64url characters>` with no path,
  duplicates, or extra query parameters.
- Never log or persist a claim URL/token.
- Never consume a claim before password submission.
- Preserve the mandatory two-method recovery-key dialog.
- Never replace a signed-in session without explicit confirmation.
- Do not alter existing unrelated dirty files in either repository.
- Use tests-first for every production behavior change.

## Task 1: Endstate claim intent and native transport

**Repository:** `endstate-gui`

1. Add parser tests covering the exact accepted URL and all rejected variants.
2. Run the tests and record the expected failure.
3. Implement the smallest pure parser.
4. Add official deep-link/single-instance dependencies, static scheme config,
   required capability, and plugin setup in the documented order.
5. Add a small frontend listener abstraction for cold and warm URLs, with the
   Tauri calls mockable in unit tests.
6. Verify parser/listener tests, `npm run build`, and Rust checks.

## Task 2: Endstate streamlined claim UI

**Repository:** `endstate-gui`

1. Add failing tests for a prefilled `Finish account setup` state, per-intent
   remounting, and the visible `Use purchase code` action.
2. Extend AuthPane/SignUpForm with explicit claim-mode inputs rather than
   inferring behavior from hidden UI state.
3. Route accepted intents into claim mode from App and keep tokens in React
   memory only.
4. Add signed-in confirmation that calls the existing logout wrapper before
   switching accounts.
5. Update existing wording tests and run the focused auth/App suite.

## Task 3: Substrate integration surface

**Repository:** `substrate`

1. Add failing tests asserting the email's exact `Use purchase code` fallback
   wording and the verified claim page's launch/copy behavior.
2. Replace the passive custom-scheme anchor with a button that copies the token
   best-effort, then launches the exact encoded URL.
3. Keep Download Endstate and Copy code visible and add concise `App didn't
   open?` guidance.
4. Align email text/HTML instructions with the first app surface.
5. Run focused tests, typecheck/lint for touched files, and build.

## Task 4: Cross-repo release verification

1. Validate the OpenSpec change strictly.
2. Run fresh focused test/build commands in both repos.
3. Build/install the Windows app and assert the `endstate` registry handler.
4. Exercise cold and warm custom URLs with a syntactically valid non-production
   token and confirm window focus plus prefill without submitting it.
5. Run an independent whole-change review; fix every critical or important
   finding and repeat targeted verification.
6. Record the shipped behavior and verification evidence in Exomem.
