# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [3.6.0](https://github.com/Artexis10/endstate-gui/compare/gui-v3.5.1...gui-v3.6.0) (2026-07-21)


### Features

* **capture:** label per-app settings coverage in scan results ([#190](https://github.com/Artexis10/endstate-gui/issues/190)) ([bf413f7](https://github.com/Artexis10/endstate-gui/commit/bf413f7b0cc0ebc720112d7ff38d820a78c14827))


### Bug Fixes

* import Tauri profile drops via native file path, not base64/IPC ([#192](https://github.com/Artexis10/endstate-gui/issues/192)) ([ed35103](https://github.com/Artexis10/endstate-gui/commit/ed35103d951c6fc34807d6ee34dca852903b433a)), closes [#187](https://github.com/Artexis10/endstate-gui/issues/187)

## [3.5.1](https://github.com/Artexis10/endstate-gui/compare/gui-v3.5.0...gui-v3.5.1) (2026-07-21)


### Bug Fixes

* import large capture bundles instead of failing silently ([#186](https://github.com/Artexis10/endstate-gui/issues/186)) ([68ddc4b](https://github.com/Artexis10/endstate-gui/commit/68ddc4b2d3d8528e2656c75f0ca001e8b768945e))

## [3.5.0](https://github.com/Artexis10/endstate-gui/compare/gui-v3.4.0...gui-v3.5.0) (2026-07-21)


### Features

* bump engine to v2.27.1 ([#183](https://github.com/Artexis10/endstate-gui/issues/183)) ([5d6b468](https://github.com/Artexis10/endstate-gui/commit/5d6b4687a2b881d9fbf3130e3beadcb60990ecec))
* **capture:** release the capture progress and Microsoft Store visibility UI ([#181](https://github.com/Artexis10/endstate-gui/issues/181)) ([b026e2b](https://github.com/Artexis10/endstate-gui/commit/b026e2b31cbb8ec0b0ba041da2dfc571fce8b56d))


### Bug Fixes

* friendly, single-row config-restore & app activity rows ([#184](https://github.com/Artexis10/endstate-gui/issues/184)) ([467afe6](https://github.com/Artexis10/endstate-gui/commit/467afe658fe01377dec5e28cbcf711b272679334))

## [3.4.0](https://github.com/Artexis10/endstate-gui/compare/gui-v3.3.0...gui-v3.4.0) (2026-07-21)


### Features

* bump engine to v2.27.0 ([#179](https://github.com/Artexis10/endstate-gui/issues/179)) ([be391da](https://github.com/Artexis10/endstate-gui/commit/be391da89ddd1af7a6adf393c201fffaa2b00064))

## [3.3.0](https://github.com/Artexis10/endstate-gui/compare/gui-v3.2.1...gui-v3.3.0) (2026-07-21)


### Features

* bump engine to v2.26.0 ([#177](https://github.com/Artexis10/endstate-gui/issues/177)) ([b3ba1d8](https://github.com/Artexis10/endstate-gui/commit/b3ba1d8480d7a1b80221dd7606315b27b90bc5c1))

## [3.2.1](https://github.com/Artexis10/endstate-gui/compare/gui-v3.2.0...gui-v3.2.1) (2026-07-20)


### Bug Fixes

* **streaming:** release the corrupted-summary parse guard ([#172](https://github.com/Artexis10/endstate-gui/issues/172)) ([b968777](https://github.com/Artexis10/endstate-gui/commit/b9687774a85f7acef1fa44af8283f4c2c7069b93))

## [3.2.0](https://github.com/Artexis10/endstate-gui/compare/gui-v3.1.0...gui-v3.2.0) (2026-07-20)


### Features

* collapse config-resolution cards into grouped presentation ([#167](https://github.com/Artexis10/endstate-gui/issues/167)) ([ba5b95d](https://github.com/Artexis10/endstate-gui/commit/ba5b95dd38898c8593921a4117a7800f75936cec))

## [3.1.0](https://github.com/Artexis10/endstate-gui/compare/gui-v3.0.0...gui-v3.1.0) (2026-07-20)


### Features

* bump engine to v2.25.0 ([#164](https://github.com/Artexis10/endstate-gui/issues/164)) ([6e5cdc8](https://github.com/Artexis10/endstate-gui/commit/6e5cdc8fa0a94fc34e70381f950ac51bf30cadd2))


### Bug Fixes

* **apply:** stop reporting work the setup flow did not do ([#163](https://github.com/Artexis10/endstate-gui/issues/163)) ([bf921c4](https://github.com/Artexis10/endstate-gui/commit/bf921c4501609630a48bc0cc13669652420b9f24))

## [3.0.0](https://github.com/Artexis10/endstate-gui/compare/gui-v2.21.4...gui-v3.0.0) (2026-07-19)


### ⚠ BREAKING CHANGES

* License activation has been removed. Users who previously activated against substratesystems.io are silently transitioned to free unlocked. Existing %APPDATA%\com.substratesystems.endstate\license.json cache files become orphaned but harmless and are no longer read by any code path. Three Tauri commands are gone (activate_license, check_license, deactivate_license), as is the entire license-gate capability spec.
* **ux:** UIMode type and related functions removed from ui-mode.ts

### refactor

* **ux:** unify workflow with progressive disclosure, remove global Advanced mode ([8501f2d](https://github.com/Artexis10/endstate-gui/commit/8501f2dffe9f8ea751138c6c54cad0e95c904e91))


### Features

* accept --profile as --manifest alias in Go engine ([ce6b1b1](https://github.com/Artexis10/endstate-gui/commit/ce6b1b1172bd86fbe9a18016179a6705e5f166b4))
* add 5-second cooldown on "Scan again" after capture completes ([4686909](https://github.com/Artexis10/endstate-gui/commit/468690953c1075c9166f3caca5c85a162692bcdd))
* add cohesive motion system for Overview page state transitions ([4ac06e0](https://github.com/Artexis10/endstate-gui/commit/4ac06e0b9d6a5c25d732c4cf2179ccd8f51ac03a))
* add config restore streaming events and status mapping ([f50a43e](https://github.com/Artexis10/endstate-gui/commit/f50a43e60de6c4fd076ccf9220da7b182c2f65ac))
* add dev-mode engine staleness detection and predev bootstrap hook ([e1e9da3](https://github.com/Artexis10/endstate-gui/commit/e1e9da34a480d2c050d846eb23e6214d7d9c349b))
* add disk-backed Reports with engine state file enumeration ([64dd074](https://github.com/Artexis10/endstate-gui/commit/64dd074b6f726a5aa5565d7ff95b09b42cb73381))
* add engine drift detection workflow ([ae77e75](https://github.com/Artexis10/endstate-gui/commit/ae77e75897008547f450d4a0b0e7adda6192d54e))
* add humanizeModuleId fallback and fuzzy winget matching for module display ([f448650](https://github.com/Artexis10/endstate-gui/commit/f44865040379ebe044a7c2122bc85330d0a2cb17))
* add license gate with LemonSqueezy activation ([5cc7a51](https://github.com/Artexis10/endstate-gui/commit/5cc7a51636fa970d0555f45082fd522bfaec09c7))
* add manual app support — apps that require manual installation ([57c545a](https://github.com/Artexis10/endstate-gui/commit/57c545a3d36465c9e9606ff4d1ca4d3bad0f0fbb))
* add Reports persistence with run artifacts and fix UI papercuts ([5baba79](https://github.com/Artexis10/endstate-gui/commit/5baba793010f882b5593de28ed2ff440c260dd98))
* add restore intent toggle and config module selector components ([f2f30de](https://github.com/Artexis10/endstate-gui/commit/f2f30de513a3f317347716ac298aad2865911245))
* add visual event buffer for smooth streaming activity reveal ([47a5f33](https://github.com/Artexis10/endstate-gui/commit/47a5f33bc2f9c01f7338907c6f7e9b84d2657ede))
* add zip import, click-to-browse drop zone, and interactive filter chips ([6b21a25](https://github.com/Artexis10/endstate-gui/commit/6b21a25980575db5de19d43ab48274c47a0b5fc5))
* app starts without license activation ([1ea23fb](https://github.com/Artexis10/endstate-gui/commit/1ea23fbd37ad33dae0bd2e4cf1c51f1f0e3b07e6))
* **auth:** add Hosted Backup claim-code branch to sign-up form ([#45](https://github.com/Artexis10/endstate-gui/issues/45)) ([486f4d5](https://github.com/Artexis10/endstate-gui/commit/486f4d5b5c4a55715f03ae3b9aa762804c21e9b7))
* auto-rebuild Go engine binary in predev script ([fa92387](https://github.com/Artexis10/endstate-gui/commit/fa92387bae8d4926a0d50dd570443976be41c2d4))
* automate engine rebuild in build pipeline, unify scripts ([2eb6a6f](https://github.com/Artexis10/endstate-gui/commit/2eb6a6f997c24ad244e4847e7f46f8476a094f04))
* **backup:** automatic hosted backup (ships dark, capability-gated) ([#80](https://github.com/Artexis10/endstate-gui/issues/80)) ([0d6c65a](https://github.com/Artexis10/endstate-gui/commit/0d6c65a5faa8631b5a301b0b3800743de04e532b))
* **backup:** friendly RATE_LIMITED auth copy + host under displayName ([#124](https://github.com/Artexis10/endstate-gui/issues/124)) ([f58d801](https://github.com/Artexis10/endstate-gui/commit/f58d80171a8788292c16c14181bd51eb7f5230c4))
* **backup:** gate the Save/Setup "push to cloud" actions with the pre-push guard ([#107](https://github.com/Artexis10/endstate-gui/issues/107)) ([1663e0b](https://github.com/Artexis10/endstate-gui/commit/1663e0bba28d244438f3ac900d909ebaed0d86f8))
* **backup:** Hosted Backup GUI ([#38](https://github.com/Artexis10/endstate-gui/issues/38)) ([2446a86](https://github.com/Artexis10/endstate-gui/commit/2446a86a4bd0a590201aca4c0d7eb1178041d598))
* **backup:** hosted-backup GUI flows (auth, backup pane, account) ([#36](https://github.com/Artexis10/endstate-gui/issues/36)) ([e542a18](https://github.com/Artexis10/endstate-gui/commit/e542a18e5af68786cb54a79f6524a28f5012241e))
* **backup:** hosted-backup polish — status visibility + first-time states ([#48](https://github.com/Artexis10/endstate-gui/issues/48)) ([c9275ae](https://github.com/Artexis10/endstate-gui/commit/c9275ae3955e03e0a651d99799ff0d0edf2ec226))
* **backup:** per-profile hosted backups addressed by id (badge-flip fix) ([#114](https://github.com/Artexis10/endstate-gui/issues/114)) ([e88761c](https://github.com/Artexis10/endstate-gui/commit/e88761cb46977ec97d8925ea0a1fbf46d69281c2))
* **backup:** polish backup pane status visibility (Wave 2) ([#60](https://github.com/Artexis10/endstate-gui/issues/60)) ([6da1cc9](https://github.com/Artexis10/endstate-gui/commit/6da1cc9e8e21996b3c09276fed3d0470ee006468))
* **backup:** rename a hosted backup (mutable label UI, gated on engine) ([#115](https://github.com/Artexis10/endstate-gui/issues/115)) ([5c62225](https://github.com/Artexis10/endstate-gui/commit/5c6222543f0a052f00c7c3cdf4d04a7205473527))
* **backup:** rewire Manage subscription to /account portal handoff (Wave 1) ([#53](https://github.com/Artexis10/endstate-gui/issues/53)) ([3ed4eaf](https://github.com/Artexis10/endstate-gui/commit/3ed4eaf0bbe1bd5c74fd16a2a1e541cf098bc36a))
* **backup:** soft pre-push quota warning in the Backup pane ([#103](https://github.com/Artexis10/endstate-gui/issues/103)) ([1453ba3](https://github.com/Artexis10/endstate-gui/commit/1453ba30058bd223124406d16380d41f06f111a0))
* **backup:** wire Subscribe/Renew to engine `backup subscribe` (engine v2.1.0) ([#39](https://github.com/Artexis10/endstate-gui/issues/39)) ([30e378f](https://github.com/Artexis10/endstate-gui/commit/30e378f808945192b463ce22b35518b1544e0342))
* bump engine to v2.10.0 ([#84](https://github.com/Artexis10/endstate-gui/issues/84)) ([922b3a4](https://github.com/Artexis10/endstate-gui/commit/922b3a4cea1b0747bc2e0d87e258768278416e24))
* bump engine to v2.11.0 ([#86](https://github.com/Artexis10/endstate-gui/issues/86)) ([bd9efe2](https://github.com/Artexis10/endstate-gui/commit/bd9efe2660718d286f877ad4700f7e4b3ffd7fcb))
* bump engine to v2.13.0 ([#95](https://github.com/Artexis10/endstate-gui/issues/95)) ([91d2819](https://github.com/Artexis10/endstate-gui/commit/91d28195805143e841724d86b5682647a295a40c))
* bump engine to v2.14.0 ([#102](https://github.com/Artexis10/endstate-gui/issues/102)) ([7771189](https://github.com/Artexis10/endstate-gui/commit/77711896f9e2167799f85058244155e0a4ee16f9))
* bump engine to v2.16.0 ([#105](https://github.com/Artexis10/endstate-gui/issues/105)) ([e953c66](https://github.com/Artexis10/endstate-gui/commit/e953c662b0de25f3458922dd7bd5b80de6ef553a))
* bump engine to v2.18.0 ([#112](https://github.com/Artexis10/endstate-gui/issues/112)) ([88bde93](https://github.com/Artexis10/endstate-gui/commit/88bde9399aeccf4dbec6a96b115ac7afe7de54e7))
* bump engine to v2.19.0 ([#116](https://github.com/Artexis10/endstate-gui/issues/116)) ([3cb83ed](https://github.com/Artexis10/endstate-gui/commit/3cb83ed8837a540dbdde445adc7d1198ce0792d6))
* bump engine to v2.20.0 ([#121](https://github.com/Artexis10/endstate-gui/issues/121)) ([4ca5803](https://github.com/Artexis10/endstate-gui/commit/4ca5803effbca136b317b049a909808c254f8330))
* bump engine to v2.20.0 ([#126](https://github.com/Artexis10/endstate-gui/issues/126)) ([5c4e17c](https://github.com/Artexis10/endstate-gui/commit/5c4e17cb767c80a470e45c592039e265f6334520))
* bump engine to v2.21.0 ([#127](https://github.com/Artexis10/endstate-gui/issues/127)) ([c07ec21](https://github.com/Artexis10/endstate-gui/commit/c07ec21a4259ae5f28c4bc7f0fa26467cca8dcf0))
* bump engine to v2.22.0 ([#130](https://github.com/Artexis10/endstate-gui/issues/130)) ([80be746](https://github.com/Artexis10/endstate-gui/commit/80be7469f7d5b57ef06fbdd6a067a391b959e6df))
* bump engine to v2.24.0 ([#141](https://github.com/Artexis10/endstate-gui/issues/141)) ([0d64307](https://github.com/Artexis10/endstate-gui/commit/0d643071e735a3384e236f5b5e556ce03435dcce))
* bump engine to v2.4.0 ([#55](https://github.com/Artexis10/endstate-gui/issues/55)) ([300b3ad](https://github.com/Artexis10/endstate-gui/commit/300b3ad4806e57e356ad64292036314eeaba2d82))
* bump engine to v2.5.0 ([#66](https://github.com/Artexis10/endstate-gui/issues/66)) ([5d8c80a](https://github.com/Artexis10/endstate-gui/commit/5d8c80aae0f52349f73a1ce0cc4cab80d58e992c))
* bump engine to v2.7.0 ([#71](https://github.com/Artexis10/endstate-gui/issues/71)) ([92bf4c0](https://github.com/Artexis10/endstate-gui/commit/92bf4c0dea8359085440e4abdce4e84528fa31d7))
* bump engine to v2.8.0 ([#76](https://github.com/Artexis10/endstate-gui/issues/76)) ([b7dc4fd](https://github.com/Artexis10/endstate-gui/commit/b7dc4fdb0d06011c6a4bb0afa7f19b6754c510e1))
* **capture:** add config module visibility to capture results ([1132c8b](https://github.com/Artexis10/endstate-gui/commit/1132c8b77c145e56f6d1dd01a19e903b84aabb26))
* **ci:** add Tauri build artifacts to release workflow ([d43de3e](https://github.com/Artexis10/endstate-gui/commit/d43de3ec9bcfc38c94934d341653901de8f0cfe0))
* complete Tidewave MCP setup with dev script and Windsurf rule ([0252e4f](https://github.com/Artexis10/endstate-gui/commit/0252e4f73e8ebabda7c84b6cc56e70c37317a950))
* **config:** add configuration generation restore UX ([#138](https://github.com/Artexis10/endstate-gui/issues/138)) ([bb73148](https://github.com/Artexis10/endstate-gui/commit/bb73148e3165bad8319198b0a4ea7881b1e0d197))
* consume enriched restoreModulesAvailable and simplify display name resolution ([7aac1d8](https://github.com/Artexis10/endstate-gui/commit/7aac1d846dce642dcc3d63051f2a9cfe33cf31f7))
* Continuous Protection — drift status surface, schedule settings card, drift chip ([#128](https://github.com/Artexis10/endstate-gui/issues/128)) ([eacdc8b](https://github.com/Artexis10/endstate-gui/commit/eacdc8b46f90cb4fb906bb74c1718c2b4014a408))
* **debug:** add persistent debug artifacts for capture diagnosis ([5617e59](https://github.com/Artexis10/endstate-gui/commit/5617e59cc1a839057ba500ef21fb1cb2955a3ad6))
* Details system, profile ID display, and capture draft-vs-saved UX ([22932c8](https://github.com/Artexis10/endstate-gui/commit/22932c8f8bc19c358c67b5acb7c9154eb673e323))
* disk-backed event replay + UI polish ([f34514d](https://github.com/Artexis10/endstate-gui/commit/f34514da8ccec86bcf050d3ae456b9ff06b6de3d))
* embed version via ldflags and add engine staleness guard ([bddbe86](https://github.com/Artexis10/endstate-gui/commit/bddbe86621ff82dad17e35ee94a2dd96c6173446))
* **events:** NDJSON-only streaming activity for capture/apply/verify ([1b0a925](https://github.com/Artexis10/endstate-gui/commit/1b0a9251377bdc3cc6c869050894cf88334a22a5))
* handle capture fallback warnings and validate save manifests ([ad88b6d](https://github.com/Artexis10/endstate-gui/commit/ad88b6d348e6893c2e584ffd33ab7b4235be341b))
* implement config export & restore system with revert functionality ([55abc14](https://github.com/Artexis10/endstate-gui/commit/55abc14f4ca93faeea200b737ffb0e2d2d3af1e7))
* implement in-memory draft only for Capture (Option A) ([f93d4e3](https://github.com/Artexis10/endstate-gui/commit/f93d4e3250432a98bb3c74e7fff787633ad4b813))
* improve Profile Details UX with Winget IDs, compact badge, and clearable display name ([cdae290](https://github.com/Artexis10/endstate-gui/commit/cdae29036d06d3c5540a9c2001d8dec9da68a224))
* integrate config restore in overview and apply flows ([c4c27a0](https://github.com/Artexis10/endstate-gui/commit/c4c27a006b1c814c1a073a5eb1dafad56117f23d))
* integrate Endstate brand assets into GUI ([2f68cbf](https://github.com/Artexis10/endstate-gui/commit/2f68cbf87f6156cb08c9332f610386f919296c64))
* integrate Tidewave as dev-only inspection tool ([0ce0cf6](https://github.com/Artexis10/endstate-gui/commit/0ce0cf65f957df4b3e6d87eebcf5ab28722ec4c9))
* intent-based UX redesign - landing screen and navigation skeleton (ADR-001) ([65c827c](https://github.com/Artexis10/endstate-gui/commit/65c827cbb64dd5cb56581eab01c88f8e0def1221))
* manual app UX, config-only separation, batch detect speedup ([bb3dbf0](https://github.com/Artexis10/endstate-gui/commit/bb3dbf067758d075bd6cad540fa4e9fff96019d7))
* migrate license system from LemonSqueezy to Ed25519 + Paddle ([cb3d70a](https://github.com/Artexis10/endstate-gui/commit/cb3d70ae583f641abaa7a51359e5ad670744b855))
* migrate to Anthracite Copper theme, fix sidebar brand alignment ([3512293](https://github.com/Artexis10/endstate-gui/commit/3512293771a11172dc0ac6ef0f1170df5c46a468))
* migrate to Warm Graphite theme, fix phase colors and settings chip count ([306b848](https://github.com/Artexis10/endstate-gui/commit/306b8485f716894b2d16c5e5c6536243d498a555))
* **openspec:** enforce level 2 validation with lefthook and sync governance doctrine ([3180bed](https://github.com/Artexis10/endstate-gui/commit/3180bed49d18401c47da4c7a94bee9dc35b90844))
* **overview:** add collapsed status strip, dismiss action, and gate divider by UI mode ([758cefd](https://github.com/Artexis10/endstate-gui/commit/758cefd5859834bddf234ea472375276ee0c873c))
* per-app picker in setup preview via apply --only ([#129](https://github.com/Artexis10/endstate-gui/issues/129)) ([8a1d087](https://github.com/Artexis10/endstate-gui/commit/8a1d087231c98a50cc7bb5db289c935a7e77cd54))
* per-module config restore selection ([d2fa548](https://github.com/Artexis10/endstate-gui/commit/d2fa548b66a6ad5dd5bc4200878a8a2833198d48))
* pin engine version via ENGINE_VERSION file ([3f8f3c6](https://github.com/Artexis10/endstate-gui/commit/3f8f3c614dfd2302c6cbce58c1d5a514324bfa51))
* **release:** sign installers via tauri-action for updater verification ([#21](https://github.com/Artexis10/endstate-gui/issues/21)) ([5b8826e](https://github.com/Artexis10/endstate-gui/commit/5b8826ec8d138dcc0c2b57b56aee086df6c45097))
* remove Overview screen, consolidate types, add undo settings support ([c0b7d1d](https://github.com/Artexis10/endstate-gui/commit/c0b7d1dff1a565870e0e78afc6b5db1a9ca9e0de))
* remove script-mode (PowerShell) engine option ([e8cba76](https://github.com/Artexis10/endstate-gui/commit/e8cba76e46a443f58aafdc617f8286d17079ffcb))
* render engine command warnings ([#143](https://github.com/Artexis10/endstate-gui/issues/143)) ([3297028](https://github.com/Artexis10/endstate-gui/commit/3297028ea2e4ffd2f4a6421277de5861a1e33e41))
* replace PowerShell engine with Go binary sidecar ([8bb0180](https://github.com/Artexis10/endstate-gui/commit/8bb0180a5b9b3b580626143f7cc5d84647efd209))
* restore rename file capability accessible from Profile Details ([9ab6b2c](https://github.com/Artexis10/endstate-gui/commit/9ab6b2c1ec1139fe46407944d60ada3bec721359))
* show bundled engine version during build and in settings ([a43e6fc](https://github.com/Artexis10/endstate-gui/commit/a43e6fc724a283c832b70789facd1cc6b641459f))
* show friendly app names and settings indicators in capture results ([1351ced](https://github.com/Artexis10/endstate-gui/commit/1351ced070b04abce78f622bba1199acb51d4647))
* show GUI version inline in Settings ([efb4a89](https://github.com/Artexis10/endstate-gui/commit/efb4a8955d6e6045db7c9b6802f3a17447855e03))
* show settings info in preview/apply results for zip bundle profiles ([798ecc2](https://github.com/Artexis10/endstate-gui/commit/798ecc25f00c36b7db15a6fbb19cb0af857d72d6))
* **ui:** enforce NDJSON-only live activity and align capture/apply/verify semantics ([73fe34b](https://github.com/Artexis10/endstate-gui/commit/73fe34bb48d3efa055f48e103fdb0e6f48866dd7))
* unified UiStatusKey mapping with phase indicator and spawn diagnostics ([ef931b1](https://github.com/Artexis10/endstate-gui/commit/ef931b169bc6e1ff9f2809ee95639cef52df2f28))
* **updater:** integrate Tauri v2 auto-updater in GUI ([#18](https://github.com/Artexis10/endstate-gui/issues/18)) ([0d102e7](https://github.com/Artexis10/endstate-gui/commit/0d102e71f72cee122fc2d69e924ee62c2a8aa40c))
* use engine-provided configModules for config-app association ([bc2b2c0](https://github.com/Artexis10/endstate-gui/commit/bc2b2c001ffb7779527e3a4acea87ec492f7768d))
* wire capture, apply, and import flows into intent-based UX (ADR-001) ([b377320](https://github.com/Artexis10/endstate-gui/commit/b377320c0fd91757943cd5db622f9b98baf350c9))


### Bug Fixes

* activate bundled sidecar resolution and stop silent PATH fallback ([0b23b33](https://github.com/Artexis10/endstate-gui/commit/0b23b3303dba998fc68c79cfc29741a0af533d5f))
* add border to cancel toast button so it reads as a button ([a4d379c](https://github.com/Artexis10/endstate-gui/commit/a4d379cc221576176fe114fde139dac823e2168a))
* add gap between toast action and cancel buttons ([d018e2b](https://github.com/Artexis10/endstate-gui/commit/d018e2b06624a9c1c35b984d7ec775ad8f46d39c))
* add gui-v tag prefix to release-please config ([b52e383](https://github.com/Artexis10/endstate-gui/commit/b52e383b7ff14875957abb57693d610fea7c683b))
* add missing OpenSpec scenarios for dev-engine-auto-rebuild and engine-bundling ([b777d72](https://github.com/Artexis10/endstate-gui/commit/b777d72f3468d2f982eacf8bcd2287f4708d860c))
* add missing runId field to streaming event test mocks ([51e9459](https://github.com/Artexis10/endstate-gui/commit/51e94591406d7e15abac46374c3270b7984a15b3))
* add per-action state props to tests and remove unused locals ([1d692ca](https://github.com/Artexis10/endstate-gui/commit/1d692cacaeb54c9fa1fcac08a9ad1db857e16191))
* add shell:allow-execute permission for Go engine sidecar ([81b76b8](https://github.com/Artexis10/endstate-gui/commit/81b76b805255a5d7c39a666d0845374b615d1416))
* align checked counter with live activity counter badges ([1ac0862](https://github.com/Artexis10/endstate-gui/commit/1ac0862d48710a9ab2a4804a67aa8f34f92836e6))
* align license cache path with NSIS cleanup and wire Tauri drag events to dropzone ([3e27137](https://github.com/Artexis10/endstate-gui/commit/3e27137437f47c9cb50344505465f62fb615e0a9))
* align StatusKey to use 'present' as canonical key, not 'already_present' ([5c783ee](https://github.com/Artexis10/endstate-gui/commit/5c783ee3b1a3477a94cc81801e3f97affd95b46c))
* **backup:** don't push to a deleted backup's stale id after delete ([#117](https://github.com/Artexis10/endstate-gui/issues/117)) ([bcbac46](https://github.com/Artexis10/endstate-gui/commit/bcbac46d678eea3989351450c2a0168a5ba10433))
* **backup:** guard in-pane restore save-dialog against unhandled rejection ([#109](https://github.com/Artexis10/endstate-gui/issues/109)) ([26745c7](https://github.com/Artexis10/endstate-gui/commit/26745c7436f1a8140db407237e7343dcbd8a28e0))
* **backup:** restore wizard re-fetches its list on every reopen ([#79](https://github.com/Artexis10/endstate-gui/issues/79)) ([e0f1205](https://github.com/Artexis10/endstate-gui/commit/e0f1205980ba6a2bd7c9452e4f6fa31798dffa28))
* **backup:** restore wizard uses shadcn Dialog instead of hand-rolled overlay ([#75](https://github.com/Artexis10/endstate-gui/issues/75)) ([1704b23](https://github.com/Artexis10/endstate-gui/commit/1704b23e8d229ea9aab78dd39e16f92b218d4a39))
* **build:** resolve pre-existing tsc errors in screenshots-harness ([#25](https://github.com/Artexis10/endstate-gui/issues/25)) ([fa01b22](https://github.com/Artexis10/endstate-gui/commit/fa01b229e4c82900378ef96efd85ae0fa5e3d2b2))
* Capture Details shows 'Detected' and Setup Details filter pills work correctly ([2c040dd](https://github.com/Artexis10/endstate-gui/commit/2c040dd7b4eaa3a5609ba1a021707d50907571e2))
* **capture:** add contract docs and tests for capture artifact invariants ([fad9de3](https://github.com/Artexis10/endstate-gui/commit/fad9de322f812a5ce5a0e4f431c2b4337fa641f0))
* **capture:** enforce artifact contract for capture/save reliability ([2451b78](https://github.com/Artexis10/endstate-gui/commit/2451b780395588b088bc753d7d0e2fe7fe79a25f))
* **capture:** repair save and import flow ([#154](https://github.com/Artexis10/endstate-gui/issues/154)) ([3104dc2](https://github.com/Artexis10/endstate-gui/commit/3104dc2c5de054d5d498ad61dbd83ecaae66f91d))
* **ci:** add VITE_DEV_BYPASS_LICENSE to e2e webServer env ([8fa0375](https://github.com/Artexis10/endstate-gui/commit/8fa03751f9bdcc5b22c7dd67122341f3640e0639))
* **ci:** add workflow_dispatch trigger for manual build recovery ([c36da22](https://github.com/Artexis10/endstate-gui/commit/c36da222d85cc915ae8bef44e5675cd6b4e9099c))
* **ci:** auth release-please via GitHub App, drop dispatch shims ([#51](https://github.com/Artexis10/endstate-gui/issues/51)) ([0408f80](https://github.com/Artexis10/endstate-gui/commit/0408f80ad82cd1c4ac94b4ed4ef753c7b85b9421))
* **ci:** correct winget-releaser action ref, add manual re-run trigger ([#131](https://github.com/Artexis10/endstate-gui/issues/131)) ([37e164c](https://github.com/Artexis10/endstate-gui/commit/37e164c7fa9d796e1d3471d6e097b5d967b90afe))
* **ci:** create empty payload directory for Tauri resource bundling ([5278a86](https://github.com/Artexis10/endstate-gui/commit/5278a86ada93fde3d112f61f8abc17e6406a4b1b))
* **ci:** create junction for engine repo at expected sidecar path ([f06b076](https://github.com/Artexis10/endstate-gui/commit/f06b076d4984cbce911badc5b9ec19bdccf60138))
* **ci:** dispatch CI on release-please PRs ([#50](https://github.com/Artexis10/endstate-gui/issues/50)) ([e84cdd6](https://github.com/Artexis10/endstate-gui/commit/e84cdd6609e448f2a11b90d6adc90145631d0a9f))
* **ci:** merge build into release-please workflow to fix token trigger issue ([7f46026](https://github.com/Artexis10/endstate-gui/commit/7f460268c85f0dcea46d336232a5b91cfce384bd))
* **ci:** mint App token in engine-drift-check so bump PRs fire CI ([#58](https://github.com/Artexis10/endstate-gui/issues/58)) ([24ba8df](https://github.com/Artexis10/endstate-gui/commit/24ba8dfd523c996e7a57d103b9bdca62c657194a))
* **ci:** roll Tauri file sync into release-please via extra-files ([#56](https://github.com/Artexis10/endstate-gui/issues/56)) ([ed5d586](https://github.com/Artexis10/endstate-gui/commit/ed5d586a2f722e1fdbb1e2992b2270cfc3faad12))
* **ci:** set ENDSTATE_ENGINE_DIR for prebuild script ([128ee45](https://github.com/Artexis10/endstate-gui/commit/128ee451cc366e88362e82f9fbd7300399037d91))
* **ci:** use vite dev server directly for e2e on CI ([5703f2e](https://github.com/Artexis10/endstate-gui/commit/5703f2e0877c4daf10c1400750b05df46fcd5078))
* **ci:** use workspace-relative path for engine repo checkout ([f8a98cc](https://github.com/Artexis10/endstate-gui/commit/f8a98ccc86f0407dd0b7897d973aa36c1be397ac))
* clarify pending recovery key exports ([#136](https://github.com/Artexis10/endstate-gui/issues/136)) ([a15320d](https://github.com/Artexis10/endstate-gui/commit/a15320d2fba9598538ed2bc5ef743a7937717836))
* clarify setup import and settings flow ([#159](https://github.com/Artexis10/endstate-gui/issues/159)) ([9c7db24](https://github.com/Artexis10/endstate-gui/commit/9c7db24b69423ddfb47173b5287961981a320e2d))
* clean topbar, simplify scroll-to-latest, remove redundant verify ([87e5930](https://github.com/Artexis10/endstate-gui/commit/87e59307e05e92f66e0938492d5340016d16e16a))
* clear overviewRunningAction on action completion to prevent stuck running strip ([a6c191f](https://github.com/Artexis10/endstate-gui/commit/a6c191f06cefb4e1fbd6cbc1462704e28c8db57e))
* configure release-please manifest mode with gui component ([8319dcb](https://github.com/Artexis10/endstate-gui/commit/8319dcbc28fce0840d44e8c566ae452b23561123))
* consolidate engine command spawning with cmd /C wrapping on Windows ([cdecfe1](https://github.com/Artexis10/endstate-gui/commit/cdecfe1832fa4e4588e052296dffd0c14c42d6ad))
* correct goToCapturePage helper to check for button instead of h1 ([65b4097](https://github.com/Artexis10/endstate-gui/commit/65b409737b86391e6a0011713be39e515c55844b))
* correct inflated app counts, filter config copy noise, and show status on settings-only apps ([64a480e](https://github.com/Artexis10/endstate-gui/commit/64a480eed52dda77875d6605973065df5de1a55c))
* correct status strip placement and remove duplicate success UI ([c5335d9](https://github.com/Artexis10/endstate-gui/commit/c5335d9fdb0a11ed1746075910094b8352d39220))
* defer result card until visual drip finishes ([53f8b3f](https://github.com/Artexis10/endstate-gui/commit/53f8b3f91f11707ccd30771c61cca36a9a61ecc1))
* **dev-bridge:** extract dev bridge to a standalone non-Tauri binary ([#87](https://github.com/Artexis10/endstate-gui/issues/87)) ([24218eb](https://github.com/Artexis10/endstate-gui/commit/24218eb80c218bda82847e80227682e3f9e5e497))
* **dev-server:** eliminate tauri:dev:browser heap corruption ([#63](https://github.com/Artexis10/endstate-gui/issues/63)) ([a852fa3](https://github.com/Artexis10/endstate-gui/commit/a852fa322c64abb72f889c55d72fa20f705efce2))
* **dev-server:** run the dev bridge headless (no host window) to remove the WebView2 crash surface ([#81](https://github.com/Artexis10/endstate-gui/issues/81)) ([8517942](https://github.com/Artexis10/endstate-gui/commit/8517942ba82e33330e71d8f47f32d3f958a594ea))
* **dev:** derive engine version from release-please manifest, not stale VERSION file ([#69](https://github.com/Artexis10/endstate-gui/issues/69)) ([e984c01](https://github.com/Artexis10/endstate-gui/commit/e984c01d71bd2f19ab7d5ee27253de7d0621f0c1))
* distinguish 'already installed' from true skips in streaming parser ([0b62068](https://github.com/Artexis10/endstate-gui/commit/0b62068b78d738752f50eaea11f38df0e3c017c7))
* draft-save flakiness + stable status cards + details affordance ([eae8618](https://github.com/Artexis10/endstate-gui/commit/eae861851c1efb95fc6defaca39396e29162335c))
* **draft:** Cancel modal does NOT delete draft (Contract A) ([9901e3e](https://github.com/Artexis10/endstate-gui/commit/9901e3ed0d467e709e1a9b85b85e7e94c7857275))
* **e2e:** add context-level Tauri mock initialization and plugin-store support ([c3e670a](https://github.com/Artexis10/endstate-gui/commit/c3e670ad21826cfb4b4eda9bb28779dcb74148ee))
* **e2e:** eliminate flakiness in ux-polish.spec.ts for first-run reliability ([2ac4e0c](https://github.com/Artexis10/endstate-gui/commit/2ac4e0c7a2e811e0c6ade8f0664157a248aa5882))
* **e2e:** fix Playwright E2E test failures ([50ecda9](https://github.com/Artexis10/endstate-gui/commit/50ecda9696d9487ea3eee1f76459cbc975a1b086))
* **e2e:** install __TAURI__ mock via context fixture before page creation ([6d1eb24](https://github.com/Artexis10/endstate-gui/commit/6d1eb24a1a640922fdd806d898fdbb5e750449f6))
* **e2e:** replace core waitForTimeout with deterministic waits ([55a6921](https://github.com/Artexis10/endstate-gui/commit/55a6921d2ab602ff41acae2c9df0e69072dafa08))
* **e2e:** replace remaining waitForTimeout with deterministic waits ([8aa4be6](https://github.com/Artexis10/endstate-gui/commit/8aa4be6ec1187f1e38d2c016c66f48723f4bf386))
* **e2e:** stabilize mocks and selectors for Playwright suite ([80cfe56](https://github.com/Artexis10/endstate-gui/commit/80cfe5652effe64c2fb60169b43338fb98418469))
* **e2e:** update E2E tests to match current UI flow and add deterministic mock engine ([5e63b3a](https://github.com/Artexis10/endstate-gui/commit/5e63b3a8931e756637eda846a111d0b73f03b6e3))
* eliminate capture card jumpiness and filter draft profiles from selection ([a3d7ee6](https://github.com/Artexis10/endstate-gui/commit/a3d7ee6a8cea4ac917e95744f82b42e154f7b67a))
* eliminate capture card jumpiness by moving status strip outside animated container ([bc09142](https://github.com/Artexis10/endstate-gui/commit/bc09142cfbf8263ab28e17572d503d3d456479d4))
* eliminate duplicate Capture success UI and enforce draft/success mutual exclusivity ([a0af809](https://github.com/Artexis10/endstate-gui/commit/a0af8098a17afb00ff27d17d8918b287742f68ac))
* eliminate jumpiness in capture card collapsed status strip ([aa507ba](https://github.com/Artexis10/endstate-gui/commit/aa507ba83d29717681955f499ee03bbf6d0b84b0))
* enforce bundled sidecar for all engine spawn paths ([916cbc6](https://github.com/Artexis10/endstate-gui/commit/916cbc65e3b0550fa8df86f4ba1d032310e1f3ef))
* enforce Capture draft vs saved profile UX contract (locked semantics) ([cd5ab0e](https://github.com/Artexis10/endstate-gui/commit/cd5ab0e434238702d4aed36e2942e88543fcbf9d))
* enforcing ruleset ([f0f2d77](https://github.com/Artexis10/endstate-gui/commit/f0f2d7791be6ded839c98ad5159a3ce66b79d154))
* exclude platform wrapper files from coverage thresholds ([0137576](https://github.com/Artexis10/endstate-gui/commit/01375767ab80ddb158701429df2a0d26cb1ee4b8))
* fix toast description and button contrast on dark theme ([434d59e](https://github.com/Artexis10/endstate-gui/commit/434d59e977ca385186d969a9ca30bd2a585feb34))
* handle missing get_bundled_engine_path command gracefully ([9e1ef27](https://github.com/Artexis10/endstate-gui/commit/9e1ef276e1370946f407655ed38105454e9984c5))
* hide manual push button once auto-backup has handled the capture ([#90](https://github.com/Artexis10/endstate-gui/issues/90)) ([fb84fd4](https://github.com/Artexis10/endstate-gui/commit/fb84fd41734282dba90801fc7b266d3d5694201c))
* **hosted-backup:** streamline claim onboarding ([79db9c3](https://github.com/Artexis10/endstate-gui/commit/79db9c392cd782160b60424855393eff365ae504))
* Implement canonical statusKey filtering and capture-specific 'detected' semantic ([7d0fe03](https://github.com/Artexis10/endstate-gui/commit/7d0fe0324880fbf8f4456155ed2c6ad2c51dbf3c))
* improve Profile Details UX and move Rename file to advanced option ([72eb19d](https://github.com/Artexis10/endstate-gui/commit/72eb19d9d1a31c064712054a83f48351c1e408ac))
* improve settings display in apply-done and clean up winget IDs ([c7a8b85](https://github.com/Artexis10/endstate-gui/commit/c7a8b859c0ed6614af0660e30354a1a8db02fc55))
* improve toast layout and description contrast ([034edf7](https://github.com/Artexis10/endstate-gui/commit/034edf701d4931b1144eb6b518845d728375dd13))
* listen for Tauri 'enter' drag event to trigger dropzone animation ([5074e42](https://github.com/Artexis10/endstate-gui/commit/5074e4217d6a204f5611a57226e76f0991ee56ff))
* make Latest button phase-aware and preserve event phase labels ([a9b6576](https://github.com/Artexis10/endstate-gui/commit/a9b65760d2bb8074b6ed2f2e2bb40d25617b4068))
* make Latest button phase-aware and preserve INSTALLED label semantics ([1b9bacb](https://github.com/Artexis10/endstate-gui/commit/1b9bacbebc92ac42d0f3b641a829a13e3749bb3d))
* make Save Profile modal explicit (no dismiss save) and add e2e guardrails ([b63a5d1](https://github.com/Artexis10/endstate-gui/commit/b63a5d1e26581c16f1e2f02107eb354ce2e2dd0a))
* map user-denied and verify-missing to distinct UI states ([f87c191](https://github.com/Artexis10/endstate-gui/commit/f87c191323d05cae92c5322d3668c8f3bb25a1f3))
* Move setOverviewRunningAction('setup') to execute BEFORE any helper function calls. This ensures the per-action state updates work correctly. ([f330351](https://github.com/Artexis10/endstate-gui/commit/f330351d38a66394942833f3de4424201f494819))
* move status strips inside expanded content under description paragraph ([fb33301](https://github.com/Artexis10/endstate-gui/commit/fb3330189e1bc8dd61f29d93f0f952c804d35e15))
* **openspec:** add missing requirement text to engine-build-ldflags delta spec ([d3b7147](https://github.com/Artexis10/endstate-gui/commit/d3b7147e21266b76f505a3406475365751abf2ff))
* **overview:** capture details modal shows apps list from envelope.data.appsIncluded ([20c2af0](https://github.com/Artexis10/endstate-gui/commit/20c2af04aa2ec3220e4227956d789a3cdc06e9e9))
* **overview:** correct capture status strip placement and eliminate expand animation jump ([5177c72](https://github.com/Artexis10/endstate-gui/commit/5177c72e632c804d86cf5d58330bccd9971cb7da))
* **overview:** Details modal now uses per-action state instead of global state ([8bfb683](https://github.com/Artexis10/endstate-gui/commit/8bfb68320d6575b6666b13974f82bacead0d4e2e))
* **overview:** eliminate expand/collapse animation jump by constraining layout animation ([627e115](https://github.com/Artexis10/endstate-gui/commit/627e115aeb5e22c075729e015f737cffabf521b4))
* **overview:** fix UI regressions - dismiss, FAILED color, Latest scroll, completion summary ([94f3e46](https://github.com/Artexis10/endstate-gui/commit/94f3e46204ae48a95f16356c291c453f593d2315))
* **overview:** make appsIncluded the only capture truth (remove NDJSON fallback) ([8eb19f7](https://github.com/Artexis10/endstate-gui/commit/8eb19f73740da1e0d6b3ce414d87ea412cafcd28))
* **overview:** prevent state leakage and improve status truthfulness ([3ab748a](https://github.com/Artexis10/endstate-gui/commit/3ab748af248aaef0ca9bc95c3564c410dfbe42eb))
* **overview:** restore capture status strip placement and compact collapsed padding ([8cb8840](https://github.com/Artexis10/endstate-gui/commit/8cb884004c8d1c156025abe149243ad234649b9b))
* **overview:** restore capture success strip and setup preview intent ([624323f](https://github.com/Artexis10/endstate-gui/commit/624323fd5356363723bd746a91eaeddf916be120))
* **overview:** restore completion strip and CTA after per-action state refactor ([1e87c02](https://github.com/Artexis10/endstate-gui/commit/1e87c0230ff4716aea1517baf11da7439049d910))
* **overview:** restore Setup Preview/Apply execution ([f330351](https://github.com/Artexis10/endstate-gui/commit/f330351d38a66394942833f3de4424201f494819))
* **overview:** restore setup/apply progress rendering with per-action state ([634e4e4](https://github.com/Artexis10/endstate-gui/commit/634e4e446e7af80ca168ad2aab6af6d9579a949f))
* **overview:** tighten expanded divider spacing and soften Latest pill color ([c87dee5](https://github.com/Artexis10/endstate-gui/commit/c87dee5ebb9a9a68da0c54dc1e545eb196f837d7))
* pass configModuleMap through overview preview result path ([1a3c6a8](https://github.com/Artexis10/endstate-gui/commit/1a3c6a808df2276212906d23f34b1a0e8576a212))
* patch tidewave eval_worker.js for Windows forward-slash ESM imports ([3f79d92](https://github.com/Artexis10/endstate-gui/commit/3f79d92ca7a8d7afa5226b3a02a94d81ef648c5e))
* phase-aware scroll tracking for live activity during verify ([71bf841](https://github.com/Artexis10/endstate-gui/commit/71bf84156eed1ae0c2d1db4b878c5942b1aa1725))
* polish capture collapsed status strip spacing and actions ([db656cd](https://github.com/Artexis10/endstate-gui/commit/db656cd29d53b92bb6f3652318f976c132632ad8))
* predev script sets ENDSTATE_ALLOW_DIRECT and reports bootstrap failures ([8920f4b](https://github.com/Artexis10/endstate-gui/commit/8920f4b5f46325339dfc05ac2762d81ea46ea795))
* preserve flow state across navigation, add session awareness UX ([9748b6b](https://github.com/Artexis10/endstate-gui/commit/9748b6b02196bd85e5acba348573063922f9d932))
* preserve run state across navigation and show truthful Reports status ([e06d719](https://github.com/Artexis10/endstate-gui/commit/e06d7190db90db81d8ae458dc8f9483a4ab6dd5f))
* prevent auto-scroll upward drift during apply phase ([5fc3517](https://github.com/Artexis10/endstate-gui/commit/5fc35178219cb551af6f3f626c6ea6a34378199c))
* prevent unsaved capture from creating profile on exit; add in-card dismiss ([4eecb97](https://github.com/Artexis10/endstate-gui/commit/4eecb97bfaaa6a2a961a0075493783c36b162888))
* reformat openspec specs to pass strict validation ([ba69448](https://github.com/Artexis10/endstate-gui/commit/ba6944805ced407ccb8ad16f7f56765f5505cc02))
* register Tauri commands and port premium UI to intent flows (ADR-001) ([ed276d3](https://github.com/Artexis10/endstate-gui/commit/ed276d3dbf90740aa73d4352961ec5340cadab05))
* **release:** pin engine v2.24.1 ([b82558f](https://github.com/Artexis10/endstate-gui/commit/b82558f61366968001346549abf720a172d3d16a))
* **release:** restore installer builds and never serve an empty "Latest" ([#120](https://github.com/Artexis10/endstate-gui/issues/120)) ([69f2a23](https://github.com/Artexis10/endstate-gui/commit/69f2a2336bcb5ec5ac42d5fc559a31f4577e2ce6))
* **release:** restore npm ci step before tauri-action ([#23](https://github.com/Artexis10/endstate-gui/issues/23)) ([ad92b0e](https://github.com/Artexis10/endstate-gui/commit/ad92b0e238251296cfa038ed6d272f5a759db154))
* remove unused imports in test files breaking tsc ([7852751](https://github.com/Artexis10/endstate-gui/commit/785275119fd693bf75b1a375f151ce672f2e1f96))
* rename rebuild-engine.js to .cjs for ESM compatibility ([b9e5ddf](https://github.com/Artexis10/endstate-gui/commit/b9e5ddf31fcb79e7b80d357b0d455890f5be8128))
* repair tauri auto-updater pipeline ([4e8a8a3](https://github.com/Artexis10/endstate-gui/commit/4e8a8a3ec95c97f9a04ce49fb73f22c0426c831a))
* replace PII in setup screenshot with sanitized mock data ([62e9133](https://github.com/Artexis10/endstate-gui/commit/62e9133f2d6e7563ec3a31940982f4cb6e4b6f91))
* Reports logs use persisted artifact paths instead of filename parsing ([b1d7c72](https://github.com/Artexis10/endstate-gui/commit/b1d7c72a13ef0aebf86e499ad32ca902362c531a))
* Reports show engine logs/events via runId and state discovery ([4a52929](https://github.com/Artexis10/endstate-gui/commit/4a52929460018dc3bb0f7bd0c28caf8d907b5b35))
* require Vite dev mode for license bypass, not just env flag ([5ca31f4](https://github.com/Artexis10/endstate-gui/commit/5ca31f41fbd312606198386518d2dd098f30068e))
* resolve 7 critical UX/state bugs (engine hang, navigation state, scrolling, truncation, status colors, partial failures, double-run) ([5563658](https://github.com/Artexis10/endstate-gui/commit/556365819c94a124f6ef3aa40b80c23547cab99a))
* resolve critical GUI blockers before merge ([1a96bf4](https://github.com/Artexis10/endstate-gui/commit/1a96bf4b2a0afd4e10e97ba5a21c736d46374da9))
* restore original apply scroll, limit phase-aware tracking to verify ([4e12e0d](https://github.com/Artexis10/endstate-gui/commit/4e12e0d4713202d817b69a914378c8038e3cb235))
* restore settings capture and save bundles ([983c372](https://github.com/Artexis10/endstate-gui/commit/983c3726d2e43b983f445b87b50b9e938810053e))
* restore UX consistency for dividers and Reports gating ([b4cec09](https://github.com/Artexis10/endstate-gui/commit/b4cec09c3233edb47a96cccf712aec2505b8301a))
* restore UX consistency for Reports run expansion and dividers ([9455014](https://github.com/Artexis10/endstate-gui/commit/9455014a1682b11b679ee4628554af11de4424d4))
* revert formatAppIdentity CamelCase heuristic — engine sends real names ([d34ea88](https://github.com/Artexis10/endstate-gui/commit/d34ea886bca98cf5e3f76fffb703dc15e5ce330b))
* save profile opt-in and reports log visibility ([6cc8999](https://github.com/Artexis10/endstate-gui/commit/6cc89993f5f71951b6c49d8b1983a8f98df1cd43))
* save zip bundles when engine produces them, add web fallback for save dialog ([5e0e352](https://github.com/Artexis10/endstate-gui/commit/5e0e352689caac6920c435d4219712ac1fbf23c5))
* **save-profile:** enforce draft content invariant before write (INV-SAVE-1) ([7dbd31c](https://github.com/Artexis10/endstate-gui/commit/7dbd31c5239296d7ca367f8ad473d63d1758b99c))
* **save-profile:** write non-empty manifest and refresh profiles after save ([3eb43e8](https://github.com/Artexis10/endstate-gui/commit/3eb43e81b6c0308ed31afb4408939c398d09b265))
* Set ENDSTATE_ALLOW_DIRECT=1 for script mode + pluralize app counts ([432e897](https://github.com/Artexis10/endstate-gui/commit/432e8979ecd76e43080d048447f6677d1496369b))
* set Sonner theme=dark to fix toast description and button contrast ([a88c18c](https://github.com/Artexis10/endstate-gui/commit/a88c18cd1a010805402e62b7760188fce337725d))
* **setup:** Setup flow Apply honors settings.dryRunEnabled ([#42](https://github.com/Artexis10/endstate-gui/issues/42)) ([433afb9](https://github.com/Artexis10/endstate-gui/commit/433afb9d477d1f6905a0731dc9013b4e5179853b))
* show friendly display names instead of Winget IDs in capture UI ([bccc5f6](https://github.com/Artexis10/endstate-gui/commit/bccc5f6057e9b3328dfa496ecd40336157dbe2a6))
* show restore selection status on config-only apps in apply results ([1677f08](https://github.com/Artexis10/endstate-gui/commit/1677f08272ec2473409744b6d64c96ba3691318b))
* stretch toast action buttons to fill available width ([80f3bdf](https://github.com/Artexis10/endstate-gui/commit/80f3bdf5ca2974e5c462ee7135d8d14f85a0c9c5))
* strip \?\ extended path prefix from bundled engine paths ([9301891](https://github.com/Artexis10/endstate-gui/commit/9301891ef6c3e30d9f0cba40642217a5210f7919))
* sync @tauri-apps/api to match Rust tauri crate version ([97a4a80](https://github.com/Artexis10/endstate-gui/commit/97a4a8008af207a41ccc5b26bb6edc97e46293b9))
* Tauri file import — single-drop triple-import and missing profiles ([561f094](https://github.com/Artexis10/endstate-gui/commit/561f094bf5fa85789bbbf3005f5d19a81c2a9c1a))
* **tests:** update failing tests to match current implementation ([b79386f](https://github.com/Artexis10/endstate-gui/commit/b79386f54976f5f08a6bc0c53405dc3dea3f00af))
* **toast:** Add dark theme for Contract E visual consistency ([2cd7a7a](https://github.com/Artexis10/endstate-gui/commit/2cd7a7a2b999d6b7bd260998870c6a30ec9736a2))
* **toast:** correct error semantics for draft vs profile missing (INV-3) ([9b64d8b](https://github.com/Artexis10/endstate-gui/commit/9b64d8bb52adedf27fd10fdab73192d7e2c4bcc8))
* **toast:** improve theming, swipe UX, and divider gating ([3912391](https://github.com/Artexis10/endstate-gui/commit/39123914d3cf20581f1df0fab12f822307703f0b))
* **toast:** restore reliable auto-dismiss + improve swipe UX ([637756a](https://github.com/Artexis10/endstate-gui/commit/637756a3f1796ed1c572cec585d11e398fdb32fa))
* update e2e tests for intent-based UI, parallelize CI with 2 workers ([7eb3479](https://github.com/Artexis10/endstate-gui/commit/7eb34792723b9415ad553915b8ea60ec417a4ffa))
* update openspec skills to v1.1.1 and add command hints to completion messages ([444e67f](https://github.com/Artexis10/endstate-gui/commit/444e67fc485cb06561e5eb9b08fe0a0223a9cc76))
* updated gitignore to eliminate test results ([ed3c0db](https://github.com/Artexis10/endstate-gui/commit/ed3c0db594e6b724f5f1f4a859c95d373ceda552))
* **updater:** enable createUpdaterArtifacts so .sig files are produced ([#27](https://github.com/Artexis10/endstate-gui/issues/27)) ([db79ce6](https://github.com/Artexis10/endstate-gui/commit/db79ce60284d8de0c5b9e5ab7bc708ee47bfb7fa))
* UX improvements for Save Profile, Reports, and Profile Details ([ac78996](https://github.com/Artexis10/endstate-gui/commit/ac78996afa202723454803ce9c8432b26b645bc3))
* **ux:** enforce semantic status contract and fix modal correctness ([bb548ad](https://github.com/Artexis10/endstate-gui/commit/bb548ad2c9a0af35e042aff31ed8a179e3674f67))
* **ux:** fix capture save flow bugs and gate View log behind showDetails ([a65459e](https://github.com/Artexis10/endstate-gui/commit/a65459eb2038bce2cf768aeaa0b8ea3ed4c16469))
* **ux:** fix draft-capture save state correctness ([8350d2a](https://github.com/Artexis10/endstate-gui/commit/8350d2aa5efe5e56a9afd93b2f6ed6fa4231846a))
* **ux:** gate advanced controls behind Show details and fix save-from-capture flow ([032d5f7](https://github.com/Artexis10/endstate-gui/commit/032d5f787c370f6cdd4750b248d5b771a04f3ff7))
* **ux:** hide profile filenames in simplified mode ([8ecb28d](https://github.com/Artexis10/endstate-gui/commit/8ecb28d60d95af6bf992e26796dd05a17b224195))
* **ux:** make capture draft save robust + restore saved state + gate advanced details ([27fcb5a](https://github.com/Artexis10/endstate-gui/commit/27fcb5abdce382668b8e0943590f2de7970a4ced))
* **ux:** Phase 3 UX semantics and visual coherence pass ([85377c8](https://github.com/Artexis10/endstate-gui/commit/85377c85dfc71159fad20d2ac7a61ff56db1de62))
* **ux:** Reports log viewer modal and Save Profile messaging ([cbde5db](https://github.com/Artexis10/endstate-gui/commit/cbde5db3b285b90f45375bc8426f5f4f69e9bf6a))
* **ux:** restore capture save state card and harden save flow ([6b50585](https://github.com/Artexis10/endstate-gui/commit/6b50585ac80fdd32763c8193ea5d98930d506692))
* **ux:** restore correct status semantics for verify Missing and streaming parsing ([7a92e2c](https://github.com/Artexis10/endstate-gui/commit/7a92e2c00277247852f55e841a5768c41bde83ee))
* **ux:** standardize Details setting, winget IDs, and in-app log viewer ([1c2566a](https://github.com/Artexis10/endstate-gui/commit/1c2566a04c272e6f21b233007118b52a47c03b61))
* **ux:** unify Details disclosure and persist global visibility setting ([821c0e6](https://github.com/Artexis10/endstate-gui/commit/821c0e6148145389415c2abdee90fc3f2a8eb358))
* **view-apps-modal:** improve UX with overflow handling, copy feedback, and app identifier consistency ([625656a](https://github.com/Artexis10/endstate-gui/commit/625656abe5db37f4214bca78381ef45327a0c898))
* ViewAppsModal UX regressions - overflow, copy feedback, and app display ([7544e85](https://github.com/Artexis10/endstate-gui/commit/7544e854a17922bbe3a0b3d90d43b0cf152a76f0))

## [2.21.4](https://github.com/Artexis10/endstate-gui/compare/gui-v2.21.3...gui-v2.21.4) (2026-07-19)


### Bug Fixes

* clarify setup import and settings flow ([#159](https://github.com/Artexis10/endstate-gui/issues/159)) ([9c7db24](https://github.com/Artexis10/endstate-gui/commit/9c7db24b69423ddfb47173b5287961981a320e2d))

## [2.21.3](https://github.com/Artexis10/endstate-gui/compare/gui-v2.21.2...gui-v2.21.3) (2026-07-18)


### Bug Fixes

* **capture:** repair save and import flow ([#154](https://github.com/Artexis10/endstate-gui/issues/154)) ([3104dc2](https://github.com/Artexis10/endstate-gui/commit/3104dc2c5de054d5d498ad61dbd83ecaae66f91d))

## [2.21.2](https://github.com/Artexis10/endstate-gui/compare/gui-v2.21.1...gui-v2.21.2) (2026-07-18)


### Bug Fixes

* restore settings capture and save bundles ([983c372](https://github.com/Artexis10/endstate-gui/commit/983c3726d2e43b983f445b87b50b9e938810053e))

## [2.21.1](https://github.com/Artexis10/endstate-gui/compare/gui-v2.21.0...gui-v2.21.1) (2026-07-18)


### Bug Fixes

* **release:** pin engine v2.24.1 ([b82558f](https://github.com/Artexis10/endstate-gui/commit/b82558f61366968001346549abf720a172d3d16a))

## [2.21.0](https://github.com/Artexis10/endstate-gui/compare/gui-v2.20.0...gui-v2.21.0) (2026-07-18)


### Features

* **config:** add configuration generation restore UX ([#138](https://github.com/Artexis10/endstate-gui/issues/138)) ([bb73148](https://github.com/Artexis10/endstate-gui/commit/bb73148e3165bad8319198b0a4ea7881b1e0d197))

## [2.20.0](https://github.com/Artexis10/endstate-gui/compare/gui-v2.19.2...gui-v2.20.0) (2026-07-17)


### Features

* bump engine to v2.24.0 ([#141](https://github.com/Artexis10/endstate-gui/issues/141)) ([0d64307](https://github.com/Artexis10/endstate-gui/commit/0d643071e735a3384e236f5b5e556ce03435dcce))
* render engine command warnings ([#143](https://github.com/Artexis10/endstate-gui/issues/143)) ([3297028](https://github.com/Artexis10/endstate-gui/commit/3297028ea2e4ffd2f4a6421277de5861a1e33e41))

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
