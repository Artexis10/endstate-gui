## 1. Engine Contract Consumption

- [x] 1.1 Add failing tests for config-resolution/config-migration parsing, type guards, and transient state behavior.
- [x] 1.2 Add additive config resolution, summary, provenance, restore-item trace, and streaming-event types required to pass the parser tests.
- [x] 1.3 Add failing tests for the apply `--restore-target` capability gate and repeatable argument construction.
- [x] 1.4 Implement off-by-default capability detection and explicit mapping argument construction without validation or default selection.
- [x] 1.5 Add failing tests for preserving engine envelope error message and remediation across the setup-flow boundary, then implement the typed error wrapper.

## 2. Resolution and Progress Presentation

- [x] 2.1 Add failing component tests for verbatim rendering of all four distilled resolution states and final rollback statuses.
- [x] 2.2 Implement config resolution rows that render engine label, message, remediation, and terminal status without copy mapping.
- [x] 2.3 Add failing component tests for an unselected ambiguous-target control, capability-off behavior, and explicit candidate selection.
- [x] 2.4 Implement the capability-gated target selector using only engine-provided candidate evidence and no version comparison or sorting.
- [x] 2.5 Add failing component tests for collapsed provenance and explicit disclosure of portable source, target, generation, fingerprint, path, revision, and reason fields.
- [x] 2.6 Implement progressive provenance disclosure with no host-path derivation.
- [x] 2.7 Add failing component tests for ordered engine-authored migration, failure, and rollback messages, then implement transient progress rendering.

## 3. Setup Flow Integration

- [x] 3.1 Add failing setup-flow tests proving config resolutions come from preview/final envelopes, legacy modules remain unchecked, and explicit target mappings are forwarded.
- [x] 3.2 Extend setup-flow input/result APIs and reset behavior for config resolutions, summaries, target mappings, progress events, and structured errors.
- [x] 3.3 Add failing App-level or browser tests proving only explicit mappings produce repeatable `--restore-target` arguments and unchecked legacy modules do not enable restore.
- [x] 3.4 Integrate capability gating, transient config events, repeatable apply arguments, and canonical final envelope data in App.
- [x] 3.5 Add a browser test covering preview, legacy consent, side-by-side target choice, migration/rollback progress, and final envelope authority.

## 4. Verification

- [ ] 4.1 Run strict OpenSpec validation, focused red-green tests, the full unit suite, contract tests, lint, TypeScript/build validation, and relevant Playwright tests.
- [x] 4.2 Review the implementation against engine GUI/event/CLI contracts and request an independent parent review with exact diff scope and verification evidence.

Verification exclusion: `npm run test:contract` currently skips because its legacy
`endstate.ps1` harness is absent from the current engine repository. The remaining
strict validation, unit, lint, type/build, and Playwright checks have executed.
