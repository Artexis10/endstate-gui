## 1. Grouped Presentation

- [x] 1.1 Rewrite `config-resolution-list.test.tsx` for grouping: ten same-verdict legacy sets collapse to one card, ambiguous-target rows stay individual, `direct` renders as a quiet line, distinct engine messages stay in separate cards, and the `legacy_unverified` warning stays visible at the top level.
- [x] 1.2 Capture the failing (red) output of the rewritten tests against the current implementation.
- [x] 1.3 Group resolutions by the composite `(resolution, label, message)` key and render one card per group with the engine label, a count, member display names, the message once, each distinct remediation once, and per-member status.
- [x] 1.4 Keep `ambiguous_target_instance` rows as individual decision cards with their target selectors, unchanged.
- [x] 1.5 Render `direct` groups as a single quiet muted line with no card chrome and no status tag.
- [x] 1.6 Move per-member provenance into one "Configuration details" disclosure per group card, preserving each member's `config-resolution-<captureId>` hook and adding `config-resolution-group-<resolution>` on the group card.
- [x] 1.7 Keep the `legacy_unverified` warning label, message, and remediation at the top level of the group card, outside the disclosure.

## 2. Completed-Apply Gate

- [x] 2.1 Extend `setup-flow-config-generations.test.tsx` with an install-only apply case asserting no configuration cards render.
- [x] 2.2 Gate the completed-apply `ConfigResolutionList` behind `restoreIntent === 'apps-and-settings' && configResolutions.length > 0`, without filtering rows by status.

## 3. Verification

- [x] 3.1 Update `e2e/config-generations.spec.ts` for group testids and disclosure interaction; keep the "Engine legacy consent warning" assertion passing without opening any disclosure.
- [x] 3.2 Run strict OpenSpec validation, the focused intent unit tests, the config-generations Playwright spec, lint, and TypeScript checks.
