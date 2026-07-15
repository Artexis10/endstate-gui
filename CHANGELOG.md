# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [2.19.2](https://github.com/Artexis10/endstate-gui/compare/gui-v2.19.1...gui-v2.19.2) (2026-07-15)


### Bug Fixes

* clarify pending recovery key exports ([#136](https://github.com/Artexis10/endstate-gui/issues/136)) ([a15320d](https://github.com/Artexis10/endstate-gui/commit/a15320d2fba9598538ed2bc5ef743a7937717836))

## [2.19.1](https://github.com/Artexis10/endstate-gui/compare/gui-v2.19.0...gui-v2.19.1) (2026-07-15)


### Bug Fixes

* **ci:** correct winget-releaser action ref, add manual re-run trigger ([#131](https://github.com/Artexis10/endstate-gui/issues/131)) ([37e164c](https://github.com/Artexis10/endstate-gui/commit/37e164c7fa9d796e1d3471d6e097b5d967b90afe))
* **hosted-backup:** streamline claim onboarding ([79db9c3](https://github.com/Artexis10/endstate-gui/commit/79db9c392cd782160b60424855393eff365ae504))

## [2.19.0](https://github.com/Artexis10/endstate-gui/compare/gui-v2.18.0...gui-v2.19.0) (2026-07-10)


### Features

* **backup:** friendly RATE_LIMITED auth copy + host under displayName ([#124](https://github.com/Artexis10/endstate-gui/issues/124)) ([f58d801](https://github.com/Artexis10/endstate-gui/commit/f58d80171a8788292c16c14181bd51eb7f5230c4))
* bump engine to v2.20.0 ([#126](https://github.com/Artexis10/endstate-gui/issues/126)) ([5c4e17c](https://github.com/Artexis10/endstate-gui/commit/5c4e17cb767c80a470e45c592039e265f6334520))
* bump engine to v2.21.0 ([#127](https://github.com/Artexis10/endstate-gui/issues/127)) ([c07ec21](https://github.com/Artexis10/endstate-gui/commit/c07ec21a4259ae5f28c4bc7f0fa26467cca8dcf0))
* bump engine to v2.22.0 ([#130](https://github.com/Artexis10/endstate-gui/issues/130)) ([80be746](https://github.com/Artexis10/endstate-gui/commit/80be7469f7d5b57ef06fbdd6a067a391b959e6df))
* Continuous Protection — drift status surface, schedule settings card, drift chip ([#128](https://github.com/Artexis10/endstate-gui/issues/128)) ([eacdc8b](https://github.com/Artexis10/endstate-gui/commit/eacdc8b46f90cb4fb906bb74c1718c2b4014a408))
* per-app picker in setup preview via apply --only ([#129](https://github.com/Artexis10/endstate-gui/issues/129)) ([8a1d087](https://github.com/Artexis10/endstate-gui/commit/8a1d087231c98a50cc7bb5db289c935a7e77cd54))

## [2.18.0](https://github.com/Artexis10/endstate-gui/compare/gui-v2.17.2...gui-v2.18.0) (2026-06-09)


### Features

* bump engine to v2.20.0 ([#121](https://github.com/Artexis10/endstate-gui/issues/121)) ([4ca5803](https://github.com/Artexis10/endstate-gui/commit/4ca5803effbca136b317b049a909808c254f8330))

## [2.17.2](https://github.com/Artexis10/endstate-gui/compare/gui-v2.17.1...gui-v2.17.2) (2026-06-08)


### Bug Fixes

* **release:** restore installer builds and never serve an empty "Latest" ([#120](https://github.com/Artexis10/endstate-gui/issues/120)) ([69f2a23](https://github.com/Artexis10/endstate-gui/commit/69f2a2336bcb5ec5ac42d5fc559a31f4577e2ce6))

## [2.17.1](https://github.com/Artexis10/endstate-gui/compare/gui-v2.17.0...gui-v2.17.1) (2026-06-07)


### Bug Fixes

* **backup:** don't push to a deleted backup's stale id after delete ([#117](https://github.com/Artexis10/endstate-gui/issues/117)) ([bcbac46](https://github.com/Artexis10/endstate-gui/commit/bcbac46d678eea3989351450c2a0168a5ba10433))

## [2.17.0](https://github.com/Artexis10/endstate-gui/compare/gui-v2.16.1...gui-v2.17.0) (2026-06-05)


### Features

* **backup:** per-profile hosted backups addressed by id (badge-flip fix) ([#114](https://github.com/Artexis10/endstate-gui/issues/114)) ([e88761c](https://github.com/Artexis10/endstate-gui/commit/e88761cb46977ec97d8925ea0a1fbf46d69281c2))
* **backup:** rename a hosted backup (mutable label UI, gated on engine) ([#115](https://github.com/Artexis10/endstate-gui/issues/115)) ([5c62225](https://github.com/Artexis10/endstate-gui/commit/5c6222543f0a052f00c7c3cdf4d04a7205473527))
* bump engine to v2.18.0 ([#112](https://github.com/Artexis10/endstate-gui/issues/112)) ([88bde93](https://github.com/Artexis10/endstate-gui/commit/88bde9399aeccf4dbec6a96b115ac7afe7de54e7))
* bump engine to v2.19.0 ([#116](https://github.com/Artexis10/endstate-gui/issues/116)) ([3cb83ed](https://github.com/Artexis10/endstate-gui/commit/3cb83ed8837a540dbdde445adc7d1198ce0792d6))

## [2.16.1](https://github.com/Artexis10/endstate-gui/compare/gui-v2.16.0...gui-v2.16.1) (2026-06-04)


### Bug Fixes

* **backup:** guard in-pane restore save-dialog against unhandled rejection ([#109](https://github.com/Artexis10/endstate-gui/issues/109)) ([26745c7](https://github.com/Artexis10/endstate-gui/commit/26745c7436f1a8140db407237e7343dcbd8a28e0))

## [2.16.0](https://github.com/Artexis10/endstate-gui/compare/gui-v2.15.0...gui-v2.16.0) (2026-06-03)


### Features

* **backup:** gate the Save/Setup "push to cloud" actions with the pre-push guard ([#107](https://github.com/Artexis10/endstate-gui/issues/107)) ([1663e0b](https://github.com/Artexis10/endstate-gui/commit/1663e0bba28d244438f3ac900d909ebaed0d86f8))
* bump engine to v2.16.0 ([#105](https://github.com/Artexis10/endstate-gui/issues/105)) ([e953c66](https://github.com/Artexis10/endstate-gui/commit/e953c662b0de25f3458922dd7bd5b80de6ef553a))

## [2.15.0](https://github.com/Artexis10/endstate-gui/compare/gui-v2.14.0...gui-v2.15.0) (2026-06-03)


### Features

* **backup:** soft pre-push quota warning in the Backup pane ([#103](https://github.com/Artexis10/endstate-gui/issues/103)) ([1453ba3](https://github.com/Artexis10/endstate-gui/commit/1453ba30058bd223124406d16380d41f06f111a0))

## [2.14.0](https://github.com/Artexis10/endstate-gui/compare/gui-v2.13.0...gui-v2.14.0) (2026-06-03)


### Features

* bump engine to v2.13.0 ([#95](https://github.com/Artexis10/endstate-gui/issues/95)) ([91d2819](https://github.com/Artexis10/endstate-gui/commit/91d28195805143e841724d86b5682647a295a40c))
* bump engine to v2.14.0 ([#102](https://github.com/Artexis10/endstate-gui/issues/102)) ([7771189](https://github.com/Artexis10/endstate-gui/commit/77711896f9e2167799f85058244155e0a4ee16f9))


### Bug Fixes

* hide manual push button once auto-backup has handled the capture ([#90](https://github.com/Artexis10/endstate-gui/issues/90)) ([fb84fd4](https://github.com/Artexis10/endstate-gui/commit/fb84fd41734282dba90801fc7b266d3d5694201c))

## [2.13.0](https://github.com/Artexis10/endstate-gui/compare/gui-v2.12.1...gui-v2.13.0) (2026-06-01)


### Features

* bump engine to v2.10.0 ([#84](https://github.com/Artexis10/endstate-gui/issues/84)) ([922b3a4](https://github.com/Artexis10/endstate-gui/commit/922b3a4cea1b0747bc2e0d87e258768278416e24))
* bump engine to v2.11.0 ([#86](https://github.com/Artexis10/endstate-gui/issues/86)) ([bd9efe2](https://github.com/Artexis10/endstate-gui/commit/bd9efe2660718d286f877ad4700f7e4b3ffd7fcb))


### Bug Fixes

* **dev-bridge:** extract dev bridge to a standalone non-Tauri binary ([#87](https://github.com/Artexis10/endstate-gui/issues/87)) ([24218eb](https://github.com/Artexis10/endstate-gui/commit/24218eb80c218bda82847e80227682e3f9e5e497))

## [2.12.1](https://github.com/Artexis10/endstate-gui/compare/gui-v2.12.0...gui-v2.12.1) (2026-05-31)


### Bug Fixes

* **dev-server:** run the dev bridge headless (no host window) to remove the WebView2 crash surface ([#81](https://github.com/Artexis10/endstate-gui/issues/81)) ([8517942](https://github.com/Artexis10/endstate-gui/commit/8517942ba82e33330e71d8f47f32d3f958a594ea))

## [2.12.0](https://github.com/Artexis10/endstate-gui/compare/gui-v2.11.0...gui-v2.12.0) (2026-05-31)


### Features

* **backup:** automatic hosted backup (ships dark, capability-gated) ([#80](https://github.com/Artexis10/endstate-gui/issues/80)) ([0d6c65a](https://github.com/Artexis10/endstate-gui/commit/0d6c65a5faa8631b5a301b0b3800743de04e532b))


### Bug Fixes

* **backup:** restore wizard re-fetches its list on every reopen ([#79](https://github.com/Artexis10/endstate-gui/issues/79)) ([e0f1205](https://github.com/Artexis10/endstate-gui/commit/e0f1205980ba6a2bd7c9452e4f6fa31798dffa28))

## [2.11.0](https://github.com/Artexis10/endstate-gui/compare/gui-v2.10.1...gui-v2.11.0) (2026-05-31)


### Features

* bump engine to v2.7.0 ([#71](https://github.com/Artexis10/endstate-gui/issues/71)) ([92bf4c0](https://github.com/Artexis10/endstate-gui/commit/92bf4c0dea8359085440e4abdce4e84528fa31d7))
* bump engine to v2.8.0 ([#76](https://github.com/Artexis10/endstate-gui/issues/76)) ([b7dc4fd](https://github.com/Artexis10/endstate-gui/commit/b7dc4fdb0d06011c6a4bb0afa7f19b6754c510e1))


### Bug Fixes

* **backup:** restore wizard uses shadcn Dialog instead of hand-rolled overlay ([#75](https://github.com/Artexis10/endstate-gui/issues/75)) ([1704b23](https://github.com/Artexis10/endstate-gui/commit/1704b23e8d229ea9aab78dd39e16f92b218d4a39))

## [2.10.1](https://github.com/Artexis10/endstate-gui/compare/gui-v2.10.0...gui-v2.10.1) (2026-05-29)


### Bug Fixes

* **dev:** derive engine version from release-please manifest, not stale VERSION file ([#69](https://github.com/Artexis10/endstate-gui/issues/69)) ([e984c01](https://github.com/Artexis10/endstate-gui/commit/e984c01d71bd2f19ab7d5ee27253de7d0621f0c1))

## [2.10.0](https://github.com/Artexis10/endstate-gui/compare/gui-v2.9.1...gui-v2.10.0) (2026-05-29)


### Features

* bump engine to v2.5.0 ([#66](https://github.com/Artexis10/endstate-gui/issues/66)) ([5d8c80a](https://github.com/Artexis10/endstate-gui/commit/5d8c80aae0f52349f73a1ce0cc4cab80d58e992c))

## [2.9.1](https://github.com/Artexis10/endstate-gui/compare/gui-v2.9.0...gui-v2.9.1) (2026-05-29)


### Bug Fixes

* **dev-server:** eliminate tauri:dev:browser heap corruption ([#63](https://github.com/Artexis10/endstate-gui/issues/63)) ([a852fa3](https://github.com/Artexis10/endstate-gui/commit/a852fa322c64abb72f889c55d72fa20f705efce2))

## [2.9.0](https://github.com/Artexis10/endstate-gui/compare/gui-v2.8.0...gui-v2.9.0) (2026-05-28)


### Features

* **backup:** polish backup pane status visibility (Wave 2) ([#60](https://github.com/Artexis10/endstate-gui/issues/60)) ([6da1cc9](https://github.com/Artexis10/endstate-gui/commit/6da1cc9e8e21996b3c09276fed3d0470ee006468))

## [2.8.0](https://github.com/Artexis10/endstate-gui/compare/gui-v2.7.0...gui-v2.8.0) (2026-05-26)


### Features

* bump engine to v2.4.0 ([#55](https://github.com/Artexis10/endstate-gui/issues/55)) ([300b3ad](https://github.com/Artexis10/endstate-gui/commit/300b3ad4806e57e356ad64292036314eeaba2d82))


### Bug Fixes

* **ci:** mint App token in engine-drift-check so bump PRs fire CI ([#58](https://github.com/Artexis10/endstate-gui/issues/58)) ([24ba8df](https://github.com/Artexis10/endstate-gui/commit/24ba8dfd523c996e7a57d103b9bdca62c657194a))
* **ci:** roll Tauri file sync into release-please via extra-files ([#56](https://github.com/Artexis10/endstate-gui/issues/56)) ([ed5d586](https://github.com/Artexis10/endstate-gui/commit/ed5d586a2f722e1fdbb1e2992b2270cfc3faad12))

## [2.7.0](https://github.com/Artexis10/endstate-gui/compare/gui-v2.6.0...gui-v2.7.0) (2026-05-26)


### Features

* **backup:** rewire Manage subscription to /account portal handoff (Wave 1) ([#53](https://github.com/Artexis10/endstate-gui/issues/53)) ([3ed4eaf](https://github.com/Artexis10/endstate-gui/commit/3ed4eaf0bbe1bd5c74fd16a2a1e541cf098bc36a))


### Bug Fixes

* **ci:** auth release-please via GitHub App, drop dispatch shims ([#51](https://github.com/Artexis10/endstate-gui/issues/51)) ([0408f80](https://github.com/Artexis10/endstate-gui/commit/0408f80ad82cd1c4ac94b4ed4ef753c7b85b9421))

## [2.6.0](https://github.com/Artexis10/endstate-gui/compare/gui-v2.5.0...gui-v2.6.0) (2026-05-26)


### Features

* **backup:** hosted-backup polish — status visibility + first-time states ([#48](https://github.com/Artexis10/endstate-gui/issues/48)) ([c9275ae](https://github.com/Artexis10/endstate-gui/commit/c9275ae3955e03e0a651d99799ff0d0edf2ec226))


### Bug Fixes

* **ci:** dispatch CI on release-please PRs ([#50](https://github.com/Artexis10/endstate-gui/issues/50)) ([e84cdd6](https://github.com/Artexis10/endstate-gui/commit/e84cdd6609e448f2a11b90d6adc90145631d0a9f))

## [2.5.0](https://github.com/Artexis10/endstate-gui/compare/gui-v2.4.1...gui-v2.5.0) (2026-05-24)


### Features

* **auth:** add Hosted Backup claim-code branch to sign-up form ([#45](https://github.com/Artexis10/endstate-gui/issues/45)) ([486f4d5](https://github.com/Artexis10/endstate-gui/commit/486f4d5b5c4a55715f03ae3b9aa762804c21e9b7))

## [2.4.1](https://github.com/Artexis10/endstate-gui/compare/gui-v2.4.0...gui-v2.4.1) (2026-05-23)


### Bug Fixes

* **setup:** Setup flow Apply honors settings.dryRunEnabled ([#42](https://github.com/Artexis10/endstate-gui/issues/42)) ([433afb9](https://github.com/Artexis10/endstate-gui/commit/433afb9d477d1f6905a0731dc9013b4e5179853b))

## [2.4.0](https://github.com/Artexis10/endstate-gui/compare/gui-v2.3.0...gui-v2.4.0) (2026-05-23)


### Features

* **backup:** wire Subscribe/Renew to engine `backup subscribe` (engine v2.1.0) ([#39](https://github.com/Artexis10/endstate-gui/issues/39)) ([30e378f](https://github.com/Artexis10/endstate-gui/commit/30e378f808945192b463ce22b35518b1544e0342))

## [2.3.0](https://github.com/Artexis10/endstate-gui/compare/gui-v2.2.1...gui-v2.3.0) (2026-05-12)


### Features

* **backup:** Hosted Backup GUI ([#38](https://github.com/Artexis10/endstate-gui/issues/38)) ([2446a86](https://github.com/Artexis10/endstate-gui/commit/2446a86a4bd0a590201aca4c0d7eb1178041d598))
* **backup:** hosted-backup GUI flows (auth, backup pane, account) ([#36](https://github.com/Artexis10/endstate-gui/issues/36)) ([e542a18](https://github.com/Artexis10/endstate-gui/commit/e542a18e5af68786cb54a79f6524a28f5012241e))

## [2.2.1](https://github.com/Artexis10/endstate-gui/compare/gui-v2.2.0...gui-v2.2.1) (2026-05-01)


### Bug Fixes

* add border to cancel toast button so it reads as a button ([a4d379c](https://github.com/Artexis10/endstate-gui/commit/a4d379cc221576176fe114fde139dac823e2168a))
* add gap between toast action and cancel buttons ([d018e2b](https://github.com/Artexis10/endstate-gui/commit/d018e2b06624a9c1c35b984d7ec775ad8f46d39c))
* fix toast description and button contrast on dark theme ([434d59e](https://github.com/Artexis10/endstate-gui/commit/434d59e977ca385186d969a9ca30bd2a585feb34))
* improve toast layout and description contrast ([034edf7](https://github.com/Artexis10/endstate-gui/commit/034edf701d4931b1144eb6b518845d728375dd13))
* set Sonner theme=dark to fix toast description and button contrast ([a88c18c](https://github.com/Artexis10/endstate-gui/commit/a88c18cd1a010805402e62b7760188fce337725d))
* stretch toast action buttons to fill available width ([80f3bdf](https://github.com/Artexis10/endstate-gui/commit/80f3bdf5ca2974e5c462ee7135d8d14f85a0c9c5))

## [2.2.0](https://github.com/Artexis10/endstate-gui/compare/gui-v2.1.1...gui-v2.2.0) (2026-05-01)


### Features

* show GUI version inline in Settings ([efb4a89](https://github.com/Artexis10/endstate-gui/commit/efb4a8955d6e6045db7c9b6802f3a17447855e03))

## [2.1.1](https://github.com/Artexis10/endstate-gui/compare/gui-v2.1.0...gui-v2.1.1) (2026-05-01)


### Bug Fixes

* repair tauri auto-updater pipeline ([4e8a8a3](https://github.com/Artexis10/endstate-gui/commit/4e8a8a3ec95c97f9a04ce49fb73f22c0426c831a))

## [2.1.0](https://github.com/Artexis10/endstate-gui/compare/gui-v2.0.0...gui-v2.1.0) (2026-05-01)


### Features

* add engine drift detection workflow ([ae77e75](https://github.com/Artexis10/endstate-gui/commit/ae77e75897008547f450d4a0b0e7adda6192d54e))
* pin engine version via ENGINE_VERSION file ([3f8f3c6](https://github.com/Artexis10/endstate-gui/commit/3f8f3c614dfd2302c6cbce58c1d5a514324bfa51))

## [2.0.0](https://github.com/Artexis10/endstate-gui/compare/gui-v1.7.2...gui-v2.0.0) (2026-04-26)


### ⚠ BREAKING CHANGES

* License activation has been removed. Users who previously activated against substratesystems.io are silently transitioned to free unlocked. Existing %APPDATA%\com.substratesystems.endstate\license.json cache files become orphaned but harmless and are no longer read by any code path. Three Tauri commands are gone (activate_license, check_license, deactivate_license), as is the entire license-gate capability spec.

### Features

* app starts without license activation ([1ea23fb](https://github.com/Artexis10/endstate-gui/commit/1ea23fbd37ad33dae0bd2e4cf1c51f1f0e3b07e6))

## [1.7.2](https://github.com/Artexis10/endstate-gui/compare/gui-v1.7.1...gui-v1.7.2) (2026-04-21)


### Bug Fixes

* **updater:** enable createUpdaterArtifacts so .sig files are produced ([#27](https://github.com/Artexis10/endstate-gui/issues/27)) ([db79ce6](https://github.com/Artexis10/endstate-gui/commit/db79ce60284d8de0c5b9e5ab7bc708ee47bfb7fa))

## [1.7.1](https://github.com/Artexis10/endstate-gui/compare/gui-v1.7.0...gui-v1.7.1) (2026-04-21)


### Bug Fixes

* **build:** resolve pre-existing tsc errors in screenshots-harness ([#25](https://github.com/Artexis10/endstate-gui/issues/25)) ([fa01b22](https://github.com/Artexis10/endstate-gui/commit/fa01b229e4c82900378ef96efd85ae0fa5e3d2b2))
* **release:** restore npm ci step before tauri-action ([#23](https://github.com/Artexis10/endstate-gui/issues/23)) ([ad92b0e](https://github.com/Artexis10/endstate-gui/commit/ad92b0e238251296cfa038ed6d272f5a759db154))

## [1.7.0](https://github.com/Artexis10/endstate-gui/compare/gui-v1.6.0...gui-v1.7.0) (2026-04-21)


### Features

* **release:** sign installers via tauri-action for updater verification ([#21](https://github.com/Artexis10/endstate-gui/issues/21)) ([5b8826e](https://github.com/Artexis10/endstate-gui/commit/5b8826ec8d138dcc0c2b57b56aee086df6c45097))
* **updater:** integrate Tauri v2 auto-updater in GUI ([#18](https://github.com/Artexis10/endstate-gui/issues/18)) ([0d102e7](https://github.com/Artexis10/endstate-gui/commit/0d102e71f72cee122fc2d69e924ee62c2a8aa40c))

## [1.6.0](https://github.com/Artexis10/endstate-gui/compare/gui-v1.5.2...gui-v1.6.0) (2026-04-14)


### Features

* migrate license system from LemonSqueezy to Ed25519 + Paddle ([cb3d70a](https://github.com/Artexis10/endstate-gui/commit/cb3d70ae583f641abaa7a51359e5ad670744b855))


### Bug Fixes

* replace PII in setup screenshot with sanitized mock data ([62e9133](https://github.com/Artexis10/endstate-gui/commit/62e9133f2d6e7563ec3a31940982f4cb6e4b6f91))

## [Unreleased]

### Changed
- **BREAKING**: License activation now uses substratesystems.io with Ed25519-signed keys issued via Paddle checkout. The prior LemonSqueezy integration is removed.
- Offline cache is now cryptographically verified; existing caches from pre-migration builds will be discarded and users must re-activate with a newly issued license key once.
- Online re-validation runs at most every 30 days; beyond that window the app requires connectivity to re-validate.


## [1.5.2](https://github.com/Artexis10/endstate-gui/compare/gui-v1.5.1...gui-v1.5.2) (2026-04-03)


### Bug Fixes

* **ci:** add workflow_dispatch trigger for manual build recovery ([c36da22](https://github.com/Artexis10/endstate-gui/commit/c36da222d85cc915ae8bef44e5675cd6b4e9099c))
* **ci:** create empty payload directory for Tauri resource bundling ([5278a86](https://github.com/Artexis10/endstate-gui/commit/5278a86ada93fde3d112f61f8abc17e6406a4b1b))
* **ci:** create junction for engine repo at expected sidecar path ([f06b076](https://github.com/Artexis10/endstate-gui/commit/f06b076d4984cbce911badc5b9ec19bdccf60138))
* **ci:** set ENDSTATE_ENGINE_DIR for prebuild script ([128ee45](https://github.com/Artexis10/endstate-gui/commit/128ee451cc366e88362e82f9fbd7300399037d91))
* **ci:** use workspace-relative path for engine repo checkout ([f8a98cc](https://github.com/Artexis10/endstate-gui/commit/f8a98ccc86f0407dd0b7897d973aa36c1be397ac))

## [1.5.1](https://github.com/Artexis10/endstate-gui/compare/gui-v1.5.0...gui-v1.5.1) (2026-04-02)


### Bug Fixes

* **ci:** merge build into release-please workflow to fix token trigger issue ([7f46026](https://github.com/Artexis10/endstate-gui/commit/7f460268c85f0dcea46d336232a5b91cfce384bd))

## [1.5.0](https://github.com/Artexis10/endstate-gui/compare/gui-v1.4.0...gui-v1.5.0) (2026-04-02)


### Features

* **ci:** add Tauri build artifacts to release workflow ([d43de3e](https://github.com/Artexis10/endstate-gui/commit/d43de3ec9bcfc38c94934d341653901de8f0cfe0))
* embed version via ldflags and add engine staleness guard ([bddbe86](https://github.com/Artexis10/endstate-gui/commit/bddbe86621ff82dad17e35ee94a2dd96c6173446))


### Bug Fixes

* **openspec:** add missing requirement text to engine-build-ldflags delta spec ([d3b7147](https://github.com/Artexis10/endstate-gui/commit/d3b7147e21266b76f505a3406475365751abf2ff))

## [1.4.0](https://github.com/Artexis10/endstate-gui/compare/gui-v1.3.6...gui-v1.4.0) (2026-03-29)


### Features

* automate engine rebuild in build pipeline, unify scripts ([2eb6a6f](https://github.com/Artexis10/endstate-gui/commit/2eb6a6f997c24ad244e4847e7f46f8476a094f04))
* show bundled engine version during build and in settings ([a43e6fc](https://github.com/Artexis10/endstate-gui/commit/a43e6fc724a283c832b70789facd1cc6b641459f))


### Bug Fixes

* listen for Tauri 'enter' drag event to trigger dropzone animation ([5074e42](https://github.com/Artexis10/endstate-gui/commit/5074e4217d6a204f5611a57226e76f0991ee56ff))

## [1.3.6](https://github.com/Artexis10/endstate-gui/compare/gui-v1.3.5...gui-v1.3.6) (2026-03-29)


### Bug Fixes

* align license cache path with NSIS cleanup and wire Tauri drag events to dropzone ([3e27137](https://github.com/Artexis10/endstate-gui/commit/3e27137437f47c9cb50344505465f62fb615e0a9))

## [1.3.5](https://github.com/Artexis10/endstate-gui/compare/gui-v1.3.4...gui-v1.3.5) (2026-03-28)


### Bug Fixes

* remove unused imports in test files breaking tsc ([7852751](https://github.com/Artexis10/endstate-gui/commit/785275119fd693bf75b1a375f151ce672f2e1f96))

## [1.3.4](https://github.com/Artexis10/endstate-gui/compare/gui-v1.3.3...gui-v1.3.4) (2026-03-28)


### Bug Fixes

* **ci:** add VITE_DEV_BYPASS_LICENSE to e2e webServer env ([8fa0375](https://github.com/Artexis10/endstate-gui/commit/8fa03751f9bdcc5b22c7dd67122341f3640e0639))

## [1.3.3](https://github.com/Artexis10/endstate-gui/compare/gui-v1.3.2...gui-v1.3.3) (2026-03-28)


### Bug Fixes

* **ci:** use vite dev server directly for e2e on CI ([5703f2e](https://github.com/Artexis10/endstate-gui/commit/5703f2e0877c4daf10c1400750b05df46fcd5078))
* update e2e tests for intent-based UI, parallelize CI with 2 workers ([7eb3479](https://github.com/Artexis10/endstate-gui/commit/7eb34792723b9415ad553915b8ea60ec417a4ffa))

## [1.3.2](https://github.com/Artexis10/endstate-gui/compare/gui-v1.3.1...gui-v1.3.2) (2026-03-28)


### Bug Fixes

* exclude platform wrapper files from coverage thresholds ([0137576](https://github.com/Artexis10/endstate-gui/commit/01375767ab80ddb158701429df2a0d26cb1ee4b8))
* require Vite dev mode for license bypass, not just env flag ([5ca31f4](https://github.com/Artexis10/endstate-gui/commit/5ca31f41fbd312606198386518d2dd098f30068e))

## [1.3.1](https://github.com/Artexis10/endstate-gui/compare/gui-v1.3.0...gui-v1.3.1) (2026-03-28)


### Bug Fixes

* enforce bundled sidecar for all engine spawn paths ([916cbc6](https://github.com/Artexis10/endstate-gui/commit/916cbc65e3b0550fa8df86f4ba1d032310e1f3ef))

## [1.3.0](https://github.com/Artexis10/endstate-gui/compare/gui-v1.2.2...gui-v1.3.0) (2026-03-27)


### Features

* consume enriched restoreModulesAvailable and simplify display name resolution ([7aac1d8](https://github.com/Artexis10/endstate-gui/commit/7aac1d846dce642dcc3d63051f2a9cfe33cf31f7))


### Bug Fixes

* activate bundled sidecar resolution and stop silent PATH fallback ([0b23b33](https://github.com/Artexis10/endstate-gui/commit/0b23b3303dba998fc68c79cfc29741a0af533d5f))
* correct inflated app counts, filter config copy noise, and show status on settings-only apps ([64a480e](https://github.com/Artexis10/endstate-gui/commit/64a480eed52dda77875d6605973065df5de1a55c))
* show restore selection status on config-only apps in apply results ([1677f08](https://github.com/Artexis10/endstate-gui/commit/1677f08272ec2473409744b6d64c96ba3691318b))

## [1.2.2](https://github.com/Artexis10/endstate-gui/compare/gui-v1.2.1...gui-v1.2.2) (2026-03-27)


### Bug Fixes

* add gui-v tag prefix to release-please config ([b52e383](https://github.com/Artexis10/endstate-gui/commit/b52e383b7ff14875957abb57693d610fea7c683b))
* configure release-please manifest mode with gui component ([8319dcb](https://github.com/Artexis10/endstate-gui/commit/8319dcbc28fce0840d44e8c566ae452b23561123))
* sync @tauri-apps/api to match Rust tauri crate version ([97a4a80](https://github.com/Artexis10/endstate-gui/commit/97a4a8008af207a41ccc5b26bb6edc97e46293b9))

## [1.2.1](https://github.com/Artexis10/endstate-gui/compare/gui-v1.1.1...gui-v1.2.1) (2026-03-26)

### Features

* Manual app status mapping with MANUAL label (warn/yellow)
* "Install manually" section in result modal with instructions + launch link
* Config-only apps separated into "Settings detected for:" section
* Config-only apps shown in capture screen
* Auto-rebuild Go engine in predev script

### Bug Fixes

* Settings count off-by-one (17 vs 18)
* Scan cooldown to prevent winget lock contention
* Null ref handling for manual apps

### Performance

* Badge counts adjusted to exclude synthesized config-only apps

## [1.1.0] - 2026-03-10

### Added
- Per-module config restore selection: choose which app settings to restore during setup
- ConfigModuleSelector shown in setup flow when "Install apps and restore settings" is selected
- All modules default to unchecked (consistent with restore-OFF-by-default principle)
- GUI passes `--restore-filter` to engine with selected module IDs

### Changed

### Fixed

## [1.0.1] - 2026-03-06

### Fixed
- Excluded screenshots-harness.tsx from production build
- Fixed broken SVG import in intent-landing.tsx (archived icon reference)

## [1.0.0] - 2026-03-06

### Added
- Desktop GUI for Endstate provisioning engine
- Profile discovery, creation, and management
- Live activity feed with real-time streaming events
- Apply and verify workflows with result modals
- Capture workflow with app selection
- Configuration export and restore UX
- License activation via checkout provider
- Advanced mode for technical details
- Engine schema compatibility handshake

### Changed

### Fixed

## [0.1.0] - 2026-03-05

### Added
- Initial release with semver versioning system

### Changed

### Fixed
