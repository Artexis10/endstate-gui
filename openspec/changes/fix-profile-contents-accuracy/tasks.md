## 1. Establish The Cross-Repo Contract

- [x] 1.1 Archive the already-shipped `add-profile-contents-view` GUI change in its own documentation PR so `profile-contents-inspection` becomes current spec truth before this delta is archived.
- [x] 1.2 Create the engine OpenSpec change for `profile inspect`, the additive `features.profileInspection` capability, and the no-machine-evaluation invariant.
- [x] 1.3 Update the engine profile, CLI JSON, and GUI integration contracts with the structured inspection envelope and label/ownership precedence.
- [x] 1.4 Validate both repositories' OpenSpec changes strictly before implementation.

## 2. Implement Read-Only Engine Inspection

- [ ] 2.1 Add failing engine tests for command routing, capability advertisement, non-null deterministic output, and structured error envelopes.
- [ ] 2.2 Add failing profile fixtures/tests for v1 explicit and legacy ownership, the `obsidian` versus `obsidian-obsidian` id mismatch, settings-only apps, ambiguous/unresolved owned modules, and v2 module deduplication/snapshot precedence.
- [ ] 2.3 Implement `endstate profile inspect <manifest-path> --json` using the existing manifest and module-catalog loaders plus verified sibling metadata/snapshots, without invoking bundle extraction, drivers, matchers, planning, preview, or mutation.
- [ ] 2.4 Build summary counts from finalized `apps[]` and `settingsApps[]`, keep every owned settings module represented, classify unique/absent/ambiguous/unresolved associations, and emit impact-typed engine-authored warnings.
- [ ] 2.5 Run targeted Go tests plus engine contract/OpenSpec validation, obtain independent review, merge the engine PR, and publish or otherwise pin a consumable engine revision.

## 3. Consume The Inspection Contract In The GUI

- [ ] 3.1 Add failing GUI contract tests for `features.profileInspection`, the `profile inspect` invocation, schema validation, stale-engine handling, and unreadable-profile errors.
- [ ] 3.2 Add typed profile-inspection envelope models and capability detection, then route **What's inside** through the dedicated engine command.
- [ ] 3.3 Remove the GUI-owned settings ownership/label inference path while retaining only structural presentation helpers such as search filtering and pluralization.
- [ ] 3.4 Update the bundled-engine revision/resources and contract fixtures to the reviewed engine build.

## 4. Build The Two-Tab Modal

- [ ] 4.1 Add failing component tests for **Apps**/**App settings** totals, default-tab selection, keyboard tab behavior, scoped search, no-results copy, and search reset across profiles.
- [ ] 4.2 Add failing regression tests proving **Settings for 8 apps** renders with eight rows, settings-only apps say **App not included**, unidentified rows do not inflate the app count, and captured-file counts stay out of default rows.
- [ ] 4.3 Implement the accessible two-tab control, scoped search, compact Setup-style rows, settings-included indicators, medium-width fixed-shell layout, and active-list-only scrolling.
- [ ] 4.4 Keep package refs, module ids, ambiguous candidates, captured-entry counts, diagnostic warnings, manifest version, and path inside **Configuration details**, while rendering presentation-affecting warnings in the normal dialog.
- [ ] 4.5 Update Set up flow integration tests to prove inspection remains independent of selection, preview, machine detection, and apply.

## 5. Verify And Release The GUI Fix

- [ ] 5.1 Run the targeted profile-content/component/Setup tests, TypeScript check, production build, contract tests, and strict OpenSpec validation.
- [ ] 5.2 Drive the real GUI against a large legacy profile and verify both tabs, all eight app-settings rows, search, settings-only labeling, keyboard behavior, and disclosure content.
- [ ] 5.3 Run the project shadow check and independent code/security review; address every correctness or contract finding.
- [ ] 5.4 Commit with a patch-triggering conventional message, open the GUI PR with engine dependency and verification evidence, and merge after CI/review.
- [ ] 5.5 Merge the resulting release-please PR and verify the published GUI release, updater manifest, signatures, and installer assets.
