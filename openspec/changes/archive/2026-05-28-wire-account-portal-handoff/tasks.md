# Tasks

## 1. Bridge surface
- [x] 1.1 Add `BackupBrowserSessionData` to `src/types.ts`
- [x] 1.2 Add `backupBrowserSession()` to `src/lib/backup-bridge.ts`

## 2. Backup pane rewire
- [x] 2.1 Add `managePending` state + ref guard to `backup-pane.tsx`
- [x] 2.2 Rewrite `handleManage` to call `backupBrowserSession`, compose
       `${accountUrl}?session=${sessionToken}`, and openExternal
- [x] 2.3 Pass `managePending` to `<SubscriptionBanner>`
- [x] 2.4 Add `managePending` prop to `SubscriptionBanner` + disable +
       "Opening…" label in `active` and `grace` branches

## 3. Account section rewire
- [x] 3.1 Add `onAuthLost?` to `AccountSectionProps`
- [x] 3.2 Add `managePending` state to `AccountSection`
- [x] 3.3 Rewrite `handleManageSubscription` to mirror backup-pane
- [x] 3.4 Disable Manage button + flip label while pending
- [x] 3.5 Pass `onAuthLost` from `App.tsx` symmetric with backup-pane

## 4. Tests
- [x] 4.1 Add `e2e/backup-browser-session.spec.ts` mirroring
       `backup-subscribe.spec.ts`: active happy path, grace happy path,
       AUTH_REQUIRED → re-auth dialog, double-click guard

## 5. Engine pin
- [x] 5.1 Bump `ENGINE_VERSION` (and `engine.pinned` in
       `endstate-gui/package.json` if applicable) to the engine release
       that ships `backup browser-session`. **Done via engine-drift-check
       auto-PR #55 (engine 2.4.0); shipped in gui 2.8.0 (#57).**
