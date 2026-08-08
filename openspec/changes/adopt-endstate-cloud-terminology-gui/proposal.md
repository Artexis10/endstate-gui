## Why

The managed backup service is publicly named **Endstate Cloud**. The GUI still calls it "Hosted Backup" in roughly two dozen user-visible strings, so the product the user pays for has one name on the website and another inside the app. The Endstate product itself is not renamed, and neither is anything the engine can see.

The rename also forces a second, overdue correction. The Continuous protection auto-push sub-toggle currently promises to "save a fresh snapshot to your cloud" when the daily check finds drift. It does neither of those things. `runScheduleAutoPush` (`endstate/go-engine/internal/commands/schedule.go`) calls `RunBackup` with `Subcommand: "push", Profile: manifestPath, IfChanged: true` — it re-uploads the manifest the user already saved, captures no fresh machine state, and runs on every scheduled run rather than only when drift is found. `docs/ux-guardrails.md` forbids misleading claims about what an operation did, so a string being rewritten anyway must be rewritten to something true.

## What Changes

- Every user-visible occurrence of "Hosted Backup" / "hosted backup" becomes **Endstate Cloud**: pane titles, the status chip's five states, the signed-out disclosure card, the subscription banner's active and unsubscribed states, the backup pane's signed-out line, the quota meter's `aria-label`, the session-check states, the auth pane's sign-in description, the re-auth dialog, the Save flow's push CTA, the Setup flow's restore CTA, the post-push toast, the engine-incompatibility notice, and the five `friendlyBackupError` headlines
- `src/components/app/settings/continuous-protection-setting.tsx`: the auto-push description is rewritten to describe what the engine actually does — re-uploading the last saved setup rather than capturing the drift the check found
- `README.md`: the section is renamed and records that the rename is public terminology only
- **No** behaviour change, **no** wire-contract change, **no** price change, and **no** renaming of the Continuous protection setting itself

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
