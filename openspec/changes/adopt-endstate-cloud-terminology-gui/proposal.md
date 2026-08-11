## Why

The managed backup service is publicly named **Endstate Cloud**. The GUI still calls it "Hosted Backup" in roughly two dozen user-visible strings, so the product the user pays for has one name on the website and another inside the app. The Endstate product itself is not renamed, and neither is anything the engine can see.

The scheduled auto-push sub-toggle captures a fresh local setup version when a scheduled check finds drift, then sends that version to the configured backup service. `docs/ux-guardrails.md` forbids misleading claims about what an operation did, so the copy must describe that lifecycle precisely.

## What Changes

- Every user-visible occurrence of "Hosted Backup" / "hosted backup" becomes **Endstate Cloud**: pane titles, the status chip's five states, the signed-out disclosure card, the subscription banner's active and unsubscribed states, the backup pane's signed-out line, the quota meter's `aria-label`, the session-check states, the auth pane's sign-in description, the re-auth dialog, the Save flow's push CTA, the Setup flow's restore CTA, the post-push toast, the engine-incompatibility notice, and the five `friendlyBackupError` headlines
- `src/components/app/settings/continuous-protection-setting.tsx`: the auto-push description is rewritten to describe the fresh local capture created after detected drift
- `README.md`: the section is renamed and records that the rename is public terminology only
- **No** behaviour change, **no** wire-contract change, and **no** price change; the public setting is renamed to `Scheduled setup checks` because the prior protection claim is not supportable

## Non-Goals

- The `hostedBackup` capabilities JSON key, `EndstateHostedBackupCapability` in `src/types.ts`, and the rest of the engine wire contract are deliberately untouched — they are cross-repo, and the rename is public terminology only
- File names, module paths, component and type identifiers, `data-testid` values, settings keys, and localStorage keys are unchanged
- `docs/contracts/hosted-backup-contract.md` keeps its filename, so code comments citing it by name stay correct and stay as they are
- `CHANGELOG.md` is historical text and is not rewritten
- The scheduled auto-push behaviour is not changed, only the copy describing it

## Capabilities

### New Capabilities

- `endstate-cloud-terminology`: the public name of the managed service in GUI copy, the identifiers deliberately excluded from the rename, and the accuracy requirement on scheduled auto-push copy.

### Modified Capabilities

- `auth-ui`: the engine-incompatibility banner copy pinned by the sign-in visibility gate.
- `backup-pane`: the subscription banner's `active` and `none` copy, and the network-failure headline example in friendly engine-error rendering.

## Impact

- `src/App.tsx` — Modified: post-push toast, two engine-incompatibility notices, two pane titles
- `src/components/app/backup/hosted-backup-chip.tsx` — Modified: five state strings
- `src/components/app/backup/hosted-backup-signed-out.tsx` — Modified: heading and description
- `src/components/app/backup/subscription-banner.tsx` — Modified: `active` and `none` titles
- `src/components/app/backup/backup-pane.tsx`, `quota-meter.tsx`, `reauth-dialog.tsx` — Modified: one string each
- `src/components/app/auth/hosted-backup-session-check.tsx` — Modified: both states
- `src/components/app/auth/auth-pane.tsx` — Modified: sign-in description
- `src/components/app/intent/save-flow.tsx`, `setup-flow.tsx` — Modified: push CTA, restore CTA and its `aria-label`
- `src/lib/backup-errors.ts` — Modified: five headlines; codes, tones, bodies, and CTAs unchanged
- `src/components/app/settings/continuous-protection-setting.tsx` — Modified: auto-push description corrected
- `README.md` — Modified: section renamed, exclusion note added
- `src/components/ui/pill.test.tsx`, `hosted-backup-chip.test.tsx`, `subscription-banner.test.tsx`, `hosted-backup-session-check.test.tsx`, `setup-flow-restore-cta.test.tsx` — Modified: assertions repinned to the new copy
