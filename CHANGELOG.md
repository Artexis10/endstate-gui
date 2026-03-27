# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## 1.0.0 (2026-03-27)


### ⚠ BREAKING CHANGES

* **ux:** UIMode type and related functions removed from ui-mode.ts
* **ux:** Default landing page is now Overview instead of Apply

### Features

* accept --profile as --manifest alias in Go engine ([ce6b1b1](https://github.com/Artexis10/endstate-gui/commit/ce6b1b1172bd86fbe9a18016179a6705e5f166b4))
* add 5-second cooldown on "Scan again" after capture completes ([4686909](https://github.com/Artexis10/endstate-gui/commit/468690953c1075c9166f3caca5c85a162692bcdd))
* add cohesive motion system for Overview page state transitions ([4ac06e0](https://github.com/Artexis10/endstate-gui/commit/4ac06e0b9d6a5c25d732c4cf2179ccd8f51ac03a))
* add config restore streaming events and status mapping ([f50a43e](https://github.com/Artexis10/endstate-gui/commit/f50a43e60de6c4fd076ccf9220da7b182c2f65ac))
* add dev-mode engine staleness detection and predev bootstrap hook ([e1e9da3](https://github.com/Artexis10/endstate-gui/commit/e1e9da34a480d2c050d846eb23e6214d7d9c349b))
* add disk-backed Reports with engine state file enumeration ([64dd074](https://github.com/Artexis10/endstate-gui/commit/64dd074b6f726a5aa5565d7ff95b09b42cb73381))
* add humanizeModuleId fallback and fuzzy winget matching for module display ([f448650](https://github.com/Artexis10/endstate-gui/commit/f44865040379ebe044a7c2122bc85330d0a2cb17))
* add license gate with LemonSqueezy activation ([5cc7a51](https://github.com/Artexis10/endstate-gui/commit/5cc7a51636fa970d0555f45082fd522bfaec09c7))
* add manual app support — apps that require manual installation ([57c545a](https://github.com/Artexis10/endstate-gui/commit/57c545a3d36465c9e9606ff4d1ca4d3bad0f0fbb))
* add Reports persistence with run artifacts and fix UI papercuts ([5baba79](https://github.com/Artexis10/endstate-gui/commit/5baba793010f882b5593de28ed2ff440c260dd98))
* add restore intent toggle and config module selector components ([f2f30de](https://github.com/Artexis10/endstate-gui/commit/f2f30de513a3f317347716ac298aad2865911245))
* add tauri-bridge for web-safe Tauri API access + E2E capture tests ([f8b6a59](https://github.com/Artexis10/endstate-gui/commit/f8b6a59ce51e57de62baa83ea908188e2e494126))
* add visual event buffer for smooth streaming activity reveal ([47a5f33](https://github.com/Artexis10/endstate-gui/commit/47a5f33bc2f9c01f7338907c6f7e9b84d2657ede))
* add zip import, click-to-browse drop zone, and interactive filter chips ([6b21a25](https://github.com/Artexis10/endstate-gui/commit/6b21a25980575db5de19d43ab48274c47a0b5fc5))
* auto-rebuild Go engine binary in predev script ([fa92387](https://github.com/Artexis10/endstate-gui/commit/fa92387bae8d4926a0d50dd570443976be41c2d4))
* **capture:** add config module visibility to capture results ([1132c8b](https://github.com/Artexis10/endstate-gui/commit/1132c8b77c145e56f6d1dd01a19e903b84aabb26))
* CLI bridge and execution model documentation for GUI integration ([f32e008](https://github.com/Artexis10/endstate-gui/commit/f32e008e78b9da7f8c7270eabbd81874cfedcdc5))
* complete Tidewave MCP setup with dev script and Windsurf rule ([0252e4f](https://github.com/Artexis10/endstate-gui/commit/0252e4f73e8ebabda7c84b6cc56e70c37317a950))
* **debug:** add persistent debug artifacts for capture diagnosis ([5617e59](https://github.com/Artexis10/endstate-gui/commit/5617e59cc1a839057ba500ef21fb1cb2955a3ad6))
* Details system, profile ID display, and capture draft-vs-saved UX ([22932c8](https://github.com/Artexis10/endstate-gui/commit/22932c8f8bc19c358c67b5acb7c9154eb673e323))
* disk-backed event replay + UI polish ([f34514d](https://github.com/Artexis10/endstate-gui/commit/f34514da8ccec86bcf050d3ae456b9ff06b6de3d))
* **events:** NDJSON-only streaming activity for capture/apply/verify ([1b0a925](https://github.com/Artexis10/endstate-gui/commit/1b0a9251377bdc3cc6c869050894cf88334a22a5))
* **gui:** add live capture progress, result modal, and progressive disclosure ([702adc6](https://github.com/Artexis10/endstate-gui/commit/702adc6505fb1059f9b7c4ab2d71bbc4b28575ab))
* **gui:** improve Apply UX flow, hierarchy, and hide technical logs by default ([1e95df9](https://github.com/Artexis10/endstate-gui/commit/1e95df99b3ba66f816d8939a4be332e05f0d5b8e))
* **gui:** polish Apply UX with result modal, outcome-first flow, and timeline collapse ([cf9b859](https://github.com/Artexis10/endstate-gui/commit/cf9b859aca1ba0c9a2a1e4f10b0f4f556eb83091))
* **gui:** premium AppShell + component kit + command palette scaffold ([3abe836](https://github.com/Artexis10/endstate-gui/commit/3abe8362b6050be9da06b175b11430afd46e682a))
* handle capture fallback warnings and validate save manifests ([ad88b6d](https://github.com/Artexis10/endstate-gui/commit/ad88b6d348e6893c2e584ffd33ab7b4235be341b))
* harden EngineAdapter with runId tagging, one-run guard, and cancellation ([01fe70e](https://github.com/Artexis10/endstate-gui/commit/01fe70ee02b0a5050c769b0eaf0a9936491ab3fc))
* implement config export & restore system with revert functionality ([55abc14](https://github.com/Artexis10/endstate-gui/commit/55abc14f4ca93faeea200b737ffb0e2d2d3af1e7))
* implement EngineAdapter for streaming NDJSON from CLI to frontend ([35492db](https://github.com/Artexis10/endstate-gui/commit/35492db48126c83a42732e52408bc3d531d4a9b4))
* implement in-memory draft only for Capture (Option A) ([f93d4e3](https://github.com/Artexis10/endstate-gui/commit/f93d4e3250432a98bb3c74e7fff787633ad4b813))
* implement profile management UX with centralized modal and safe deletion ([d1b8445](https://github.com/Artexis10/endstate-gui/commit/d1b8445f1d09c8b466130e66245834c2fbc34c5a))
* improve Profile Details UX with Winget IDs, compact badge, and clearable display name ([cdae290](https://github.com/Artexis10/endstate-gui/commit/cdae29036d06d3c5540a9c2001d8dec9da68a224))
* integrate config restore in overview and apply flows ([c4c27a0](https://github.com/Artexis10/endstate-gui/commit/c4c27a006b1c814c1a073a5eb1dafad56117f23d))
* integrate Endstate brand assets into GUI ([2f68cbf](https://github.com/Artexis10/endstate-gui/commit/2f68cbf87f6156cb08c9332f610386f919296c64))
* integrate Tidewave as dev-only inspection tool ([0ce0cf6](https://github.com/Artexis10/endstate-gui/commit/0ce0cf65f957df4b3e6d87eebcf5ab28722ec4c9))
* intent-based UX redesign - landing screen and navigation skeleton (ADR-001) ([65c827c](https://github.com/Artexis10/endstate-gui/commit/65c827cbb64dd5cb56581eab01c88f8e0def1221))
* manual app UX, config-only separation, batch detect speedup ([bb3dbf0](https://github.com/Artexis10/endstate-gui/commit/bb3dbf067758d075bd6cad540fa4e9fff96019d7))
* migrate to Anthracite Copper theme, fix sidebar brand alignment ([3512293](https://github.com/Artexis10/endstate-gui/commit/3512293771a11172dc0ac6ef0f1170df5c46a468))
* migrate to Warm Graphite theme, fix phase colors and settings chip count ([306b848](https://github.com/Artexis10/endstate-gui/commit/306b8485f716894b2d16c5e5c6536243d498a555))
* **openspec:** enforce level 2 validation with lefthook and sync governance doctrine ([3180bed](https://github.com/Artexis10/endstate-gui/commit/3180bed49d18401c47da4c7a94bee9dc35b90844))
* **overview:** add collapsed status strip, dismiss action, and gate divider by UI mode ([758cefd](https://github.com/Artexis10/endstate-gui/commit/758cefd5859834bddf234ea472375276ee0c873c))
* per-module config restore selection ([d2fa548](https://github.com/Artexis10/endstate-gui/commit/d2fa548b66a6ad5dd5bc4200878a8a2833198d48))
* remove Overview screen, consolidate types, add undo settings support ([c0b7d1d](https://github.com/Artexis10/endstate-gui/commit/c0b7d1dff1a565870e0e78afc6b5db1a9ca9e0de))
* replace PowerShell engine with Go binary sidecar ([8bb0180](https://github.com/Artexis10/endstate-gui/commit/8bb0180a5b9b3b580626143f7cc5d84647efd209))
* restore rename file capability accessible from Profile Details ([9ab6b2c](https://github.com/Artexis10/endstate-gui/commit/9ab6b2c1ec1139fe46407944d60ada3bec721359))
* scaffold Tauri app with CLI execution wiring and capabilities check ([88141c2](https://github.com/Artexis10/endstate-gui/commit/88141c2af4c59128f1701e86da68055d56f7e2a1))
* show friendly app names and settings indicators in capture results ([1351ced](https://github.com/Artexis10/endstate-gui/commit/1351ced070b04abce78f622bba1199acb51d4647))
* show settings info in preview/apply results for zip bundle profiles ([798ecc2](https://github.com/Artexis10/endstate-gui/commit/798ecc25f00c36b7db15a6fbb19cb0af857d72d6))
* **ui:** enforce NDJSON-only live activity and align capture/apply/verify semantics ([73fe34b](https://github.com/Artexis10/endstate-gui/commit/73fe34bb48d3efa055f48e103fdb0e6f48866dd7))
* unified UiStatusKey mapping with phase indicator and spawn diagnostics ([ef931b1](https://github.com/Artexis10/endstate-gui/commit/ef931b169bc6e1ff9f2809ee95639cef52df2f28))
* use engine-provided configModules for config-app association ([bc2b2c0](https://github.com/Artexis10/endstate-gui/commit/bc2b2c001ffb7779527e3a4acea87ec492f7768d))
* **ux:** implement global lifecycle state, intent-driven buttons, and Report page MVP ([5cbabf9](https://github.com/Artexis10/endstate-gui/commit/5cbabf92b2db71ac9075f40b1390bacf977e88b0))
* **ux:** introduce lifecycle-driven UX with Overview screen and progressive disclosure ([8ebe5a9](https://github.com/Artexis10/endstate-gui/commit/8ebe5a9941255477cbe9589e4c62324e37b26d7b))
* **ux:** transform Overview cards into expandable action-in-place panels ([240f651](https://github.com/Artexis10/endstate-gui/commit/240f651ed493196e0292e603b5f1de6d96f3c2b1))
* wire capture, apply, and import flows into intent-based UX (ADR-001) ([b377320](https://github.com/Artexis10/endstate-gui/commit/b377320c0fd91757943cd5db622f9b98baf350c9))


### Bug Fixes

* add gui-v tag prefix to release-please config ([b52e383](https://github.com/Artexis10/endstate-gui/commit/b52e383b7ff14875957abb57693d610fea7c683b))
* add missing lastSelectedProfilePath to test mockSettings ([38de47a](https://github.com/Artexis10/endstate-gui/commit/38de47a24cd0282dcb20e37bb15b41a21c363e89))
* add missing OpenSpec scenarios for dev-engine-auto-rebuild and engine-bundling ([b777d72](https://github.com/Artexis10/endstate-gui/commit/b777d72f3468d2f982eacf8bcd2287f4708d860c))
* add missing runId field to streaming event test mocks ([51e9459](https://github.com/Artexis10/endstate-gui/commit/51e94591406d7e15abac46374c3270b7984a15b3))
* add per-action state props to tests and remove unused locals ([1d692ca](https://github.com/Artexis10/endstate-gui/commit/1d692cacaeb54c9fa1fcac08a9ad1db857e16191))
* add shell:allow-execute permission for Go engine sidecar ([81b76b8](https://github.com/Artexis10/endstate-gui/commit/81b76b805255a5d7c39a666d0845374b615d1416))
* add Tauri icon assets and document Windows/Rust/MSVC prerequisites ([79518f8](https://github.com/Artexis10/endstate-gui/commit/79518f84f621af84a23d92f7734ecaf7d5f39e7c))
* align checked counter with live activity counter badges ([1ac0862](https://github.com/Artexis10/endstate-gui/commit/1ac0862d48710a9ab2a4804a67aa8f34f92836e6))
* align StatusKey to use 'present' as canonical key, not 'already_present' ([5c783ee](https://github.com/Artexis10/endstate-gui/commit/5c783ee3b1a3477a94cc81801e3f97affd95b46c))
* **apply:** add dev-only debug logging for apply envelope shape ([1e71367](https://github.com/Artexis10/endstate-gui/commit/1e713671a75af447f8fee86a09361cd176de6763))
* **apply:** categorized tree view, accurate counts, real-time progress ([cdbb586](https://github.com/Artexis10/endstate-gui/commit/cdbb5867b26ce1204520bc43a67fc0a31998f4fe))
* **apply:** correct UX semantics for Apply modal - rename categories, fix phase-aware display ([c31646b](https://github.com/Artexis10/endstate-gui/commit/c31646b58ba0ad98ad6568b6d18d411419af7a94))
* **apply:** prevent double-click / re-render from starting apply twice ([c4ddc82](https://github.com/Artexis10/endstate-gui/commit/c4ddc82d3453fee0ca067f443b68de0a38b4a64e))
* **apply:** show ApplyResultModal with accurate counts + real-time progress + persist activity ([b4579b7](https://github.com/Artexis10/endstate-gui/commit/b4579b77b7bdce33f667c921cded1d6a218b2942))
* **boot:** prevent infinite hang when Tauri streaming unavailable ([1b93084](https://github.com/Artexis10/endstate-gui/commit/1b930845c9b88f04eb261110e3127f6af8b72e62))
* **build:** remove unused symbols blocking tsc ([96d74f1](https://github.com/Artexis10/endstate-gui/commit/96d74f16c62f188ad862ff25376e472cef023dfd))
* Capture Details shows 'Detected' and Setup Details filter pills work correctly ([2c040dd](https://github.com/Artexis10/endstate-gui/commit/2c040dd7b4eaa3a5609ba1a021707d50907571e2))
* **capture:** add contract docs and tests for capture artifact invariants ([fad9de3](https://github.com/Artexis10/endstate-gui/commit/fad9de322f812a5ce5a0e4f431c2b4337fa641f0))
* **capture:** enforce artifact contract for capture/save reliability ([2451b78](https://github.com/Artexis10/endstate-gui/commit/2451b780395588b088bc753d7d0e2fe7fe79a25f))
* **capture:** show accurate captured app list + add e2e coverage ([b7bbb38](https://github.com/Artexis10/endstate-gui/commit/b7bbb38eed72d35ada5dc12ef651c813f0573773))
* clean topbar, simplify scroll-to-latest, remove redundant verify ([87e5930](https://github.com/Artexis10/endstate-gui/commit/87e59307e05e92f66e0938492d5340016d16e16a))
* clear overviewRunningAction on action completion to prevent stuck running strip ([a6c191f](https://github.com/Artexis10/endstate-gui/commit/a6c191f06cefb4e1fbd6cbc1462704e28c8db57e))
* configure Vite to exclude Tauri from pre-bundling ([5bd2ab2](https://github.com/Artexis10/endstate-gui/commit/5bd2ab2d8420a482796e31516cd9e2e3c239d153))
* consolidate engine command spawning with cmd /C wrapping on Windows ([cdecfe1](https://github.com/Artexis10/endstate-gui/commit/cdecfe1832fa4e4588e052296dffd0c14c42d6ad))
* correct goToCapturePage helper to check for button instead of h1 ([65b4097](https://github.com/Artexis10/endstate-gui/commit/65b409737b86391e6a0011713be39e515c55844b))
* correct status strip placement and remove duplicate success UI ([c5335d9](https://github.com/Artexis10/endstate-gui/commit/c5335d9fdb0a11ed1746075910094b8352d39220))
* defer result card until visual drip finishes ([53f8b3f](https://github.com/Artexis10/endstate-gui/commit/53f8b3f91f11707ccd30771c61cca36a9a61ecc1))
* **dev:** prevent test/web settings from breaking tauri runtime ([38556d0](https://github.com/Artexis10/endstate-gui/commit/38556d09f7ba022d656f0ecbb38ac020ce5020b4))
* distinguish 'already installed' from true skips in streaming parser ([0b62068](https://github.com/Artexis10/endstate-gui/commit/0b62068b78d738752f50eaea11f38df0e3c017c7))
* draft-save flakiness + stable status cards + details affordance ([eae8618](https://github.com/Artexis10/endstate-gui/commit/eae861851c1efb95fc6defaca39396e29162335c))
* **draft:** Cancel modal does NOT delete draft (Contract A) ([9901e3e](https://github.com/Artexis10/endstate-gui/commit/9901e3ed0d467e709e1a9b85b85e7e94c7857275))
* **e2e:** add context-level Tauri mock initialization and plugin-store support ([c3e670a](https://github.com/Artexis10/endstate-gui/commit/c3e670ad21826cfb4b4eda9bb28779dcb74148ee))
* **e2e:** eliminate flakiness in ux-polish.spec.ts for first-run reliability ([2ac4e0c](https://github.com/Artexis10/endstate-gui/commit/2ac4e0c7a2e811e0c6ade8f0664157a248aa5882))
* **e2e:** fix Playwright E2E test failures ([50ecda9](https://github.com/Artexis10/endstate-gui/commit/50ecda9696d9487ea3eee1f76459cbc975a1b086))
* **e2e:** install __TAURI__ mock via context fixture before page creation ([6d1eb24](https://github.com/Artexis10/endstate-gui/commit/6d1eb24a1a640922fdd806d898fdbb5e750449f6))
* **e2e:** make tests deterministic with explicit navigation helpers ([9205e2f](https://github.com/Artexis10/endstate-gui/commit/9205e2f53d948844bbd7958baf0f4f58baf1eec7))
* **e2e:** replace core waitForTimeout with deterministic waits ([55a6921](https://github.com/Artexis10/endstate-gui/commit/55a6921d2ab602ff41acae2c9df0e69072dafa08))
* **e2e:** replace remaining waitForTimeout with deterministic waits ([8aa4be6](https://github.com/Artexis10/endstate-gui/commit/8aa4be6ec1187f1e38d2c016c66f48723f4bf386))
* **e2e:** stabilize mocks and selectors for Playwright suite ([80cfe56](https://github.com/Artexis10/endstate-gui/commit/80cfe5652effe64c2fb60169b43338fb98418469))
* **e2e:** update E2E tests to match current UI flow and add deterministic mock engine ([5e63b3a](https://github.com/Artexis10/endstate-gui/commit/5e63b3a8931e756637eda846a111d0b73f03b6e3))
* eliminate capture card jumpiness and filter draft profiles from selection ([a3d7ee6](https://github.com/Artexis10/endstate-gui/commit/a3d7ee6a8cea4ac917e95744f82b42e154f7b67a))
* eliminate capture card jumpiness by moving status strip outside animated container ([bc09142](https://github.com/Artexis10/endstate-gui/commit/bc09142cfbf8263ab28e17572d503d3d456479d4))
* eliminate duplicate Capture success UI and enforce draft/success mutual exclusivity ([a0af809](https://github.com/Artexis10/endstate-gui/commit/a0af8098a17afb00ff27d17d8918b287742f68ac))
* eliminate jumpiness in capture card collapsed status strip ([aa507ba](https://github.com/Artexis10/endstate-gui/commit/aa507ba83d29717681955f499ee03bbf6d0b84b0))
* enforce Capture draft vs saved profile UX contract (locked semantics) ([cd5ab0e](https://github.com/Artexis10/endstate-gui/commit/cd5ab0e434238702d4aed36e2942e88543fcbf9d))
* enforce single Tauri import point via tauri-bridge to prevent web-only E2E boot crashes ([5be3b46](https://github.com/Artexis10/endstate-gui/commit/5be3b462d48cb2e9012ca5e2e8f075810e8bd892))
* enforcing ruleset ([f0f2d77](https://github.com/Artexis10/endstate-gui/commit/f0f2d7791be6ded839c98ad5159a3ce66b79d154))
* **engine:** run capabilities via non-streaming exec and clear stale error ([c9edae1](https://github.com/Artexis10/endstate-gui/commit/c9edae19230a27bff5e1ba1d3a799d7bbaa189aa))
* **gui:** correct Capture counts, live per-app progress, and consistent Capture naming ([c0c484b](https://github.com/Artexis10/endstate-gui/commit/c0c484b69843cf6cfb5b6469d14a6b9bc386b4f1))
* **gui:** finalize Apply UX with clean timeline, result modal polish, and setup add flow ([7c33714](https://github.com/Artexis10/endstate-gui/commit/7c33714523d70e9c335dc8952bf1136f579079e7))
* **gui:** improve Capture/Apply UX with accurate counts, live progress, and persistent Last Run tracking ([0b46ba5](https://github.com/Artexis10/endstate-gui/commit/0b46ba5c91a6c229c7b6f602c62d4db1d8749646))
* **gui:** resolve Apply timeline duplication and polish result modal actions ([74994ea](https://github.com/Artexis10/endstate-gui/commit/74994ea537ab0f2142e52af1851b7bff24fc1227))
* **gui:** stabilize Tailwind v3 PostCSS config for tauri dev ([f963909](https://github.com/Artexis10/endstate-gui/commit/f963909329226e74b1e4e6f59975861508b880ad))
* handle missing get_bundled_engine_path command gracefully ([9e1ef27](https://github.com/Artexis10/endstate-gui/commit/9e1ef276e1370946f407655ed38105454e9984c5))
* Implement canonical statusKey filtering and capture-specific 'detected' semantic ([7d0fe03](https://github.com/Artexis10/endstate-gui/commit/7d0fe0324880fbf8f4456155ed2c6ad2c51dbf3c))
* improve JSON envelope parsing and error UX ([d55fe46](https://github.com/Artexis10/endstate-gui/commit/d55fe4616569ac5a53274fbb3e4ce26f9eb7b400))
* improve Profile Details UX and move Rename file to advanced option ([72eb19d](https://github.com/Artexis10/endstate-gui/commit/72eb19d9d1a31c064712054a83f48351c1e408ac))
* improve settings display in apply-done and clean up winget IDs ([c7a8b85](https://github.com/Artexis10/endstate-gui/commit/c7a8b859c0ed6614af0660e30354a1a8db02fc55))
* increase log buffer cap and ensure complete output visibility ([535e15b](https://github.com/Artexis10/endstate-gui/commit/535e15bdf8a6cc556a40fa76ac77494eecdca75d))
* integrate engine test seam and fix Capture/Apply state management ([f4b7bad](https://github.com/Artexis10/endstate-gui/commit/f4b7badb42d332b59e9998f1d506b243f5505911))
* live activity semantics, setup details filtering, status reconciliation ([9c74760](https://github.com/Artexis10/endstate-gui/commit/9c7476073014b3ef37769519d70680160cd32a01))
* make Latest button phase-aware and preserve event phase labels ([a9b6576](https://github.com/Artexis10/endstate-gui/commit/a9b65760d2bb8074b6ed2f2e2bb40d25617b4068))
* make Latest button phase-aware and preserve INSTALLED label semantics ([1b9bacb](https://github.com/Artexis10/endstate-gui/commit/1b9bacbebc92ac42d0f3b641a829a13e3749bb3d))
* make profile validation pure to prevent test hangs ([8d808a5](https://github.com/Artexis10/endstate-gui/commit/8d808a5a9abd2ff04a0b6566972b7ce98cc317ff))
* make Save Profile modal explicit (no dismiss save) and add e2e guardrails ([b63a5d1](https://github.com/Artexis10/endstate-gui/commit/b63a5d1e26581c16f1e2f02107eb354ce2e2dd0a))
* map user-denied and verify-missing to distinct UI states ([f87c191](https://github.com/Artexis10/endstate-gui/commit/f87c191323d05cae92c5322d3668c8f3bb25a1f3))
* **modals:** show accurate capture/apply summaries + trees + e2e coverage ([8a43078](https://github.com/Artexis10/endstate-gui/commit/8a43078434479539448c6c82d63cd64b2705ffd9))
* Move setOverviewRunningAction('setup') to execute BEFORE any helper function calls. This ensures the per-action state updates work correctly. ([f330351](https://github.com/Artexis10/endstate-gui/commit/f330351d38a66394942833f3de4424201f494819))
* move status strips inside expanded content under description paragraph ([fb33301](https://github.com/Artexis10/endstate-gui/commit/fb3330189e1bc8dd61f29d93f0f952c804d35e15))
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
* pass full setup file paths to engine verify/apply ([28b317e](https://github.com/Artexis10/endstate-gui/commit/28b317e62c7cc91566691e40345b2a1d3aa85ee5))
* patch tidewave eval_worker.js for Windows forward-slash ESM imports ([3f79d92](https://github.com/Artexis10/endstate-gui/commit/3f79d92ca7a8d7afa5226b3a02a94d81ef648c5e))
* phase-aware scroll tracking for live activity during verify ([71bf841](https://github.com/Artexis10/endstate-gui/commit/71bf84156eed1ae0c2d1db4b878c5942b1aa1725))
* polish capture collapsed status strip spacing and actions ([db656cd](https://github.com/Artexis10/endstate-gui/commit/db656cd29d53b92bb6f3652318f976c132632ad8))
* predev script sets ENDSTATE_ALLOW_DIRECT and reports bootstrap failures ([8920f4b](https://github.com/Artexis10/endstate-gui/commit/8920f4b5f46325339dfc05ac2762d81ea46ea795))
* preserve flow state across navigation, add session awareness UX ([9748b6b](https://github.com/Artexis10/endstate-gui/commit/9748b6b02196bd85e5acba348573063922f9d932))
* preserve run state across navigation and show truthful Reports status ([e06d719](https://github.com/Artexis10/endstate-gui/commit/e06d7190db90db81d8ae458dc8f9483a4ab6dd5f))
* prevent 'To install' pill truncation in Setup Details modal ([bac1068](https://github.com/Artexis10/endstate-gui/commit/bac1068dfdca034e45311e794ea836c0a401a513))
* prevent auto-scroll upward drift during apply phase ([5fc3517](https://github.com/Artexis10/endstate-gui/commit/5fc35178219cb551af6f3f626c6ea6a34378199c))
* prevent unsaved capture from creating profile on exit; add in-card dismiss ([4eecb97](https://github.com/Artexis10/endstate-gui/commit/4eecb97bfaaa6a2a961a0075493783c36b162888))
* profile contract docs, remove duplicate Open folder, fix pb-2 padding ([e49c09b](https://github.com/Artexis10/endstate-gui/commit/e49c09b9c82894d09969397083302daaefd4020d))
* **profile-management:** UX improvements and contract fixes ([27cb4c8](https://github.com/Artexis10/endstate-gui/commit/27cb4c82fa56c0a775b58c5db9decc2ed8cf39be))
* reformat openspec specs to pass strict validation ([ba69448](https://github.com/Artexis10/endstate-gui/commit/ba6944805ced407ccb8ad16f7f56765f5505cc02))
* register Tauri commands and port premium UI to intent flows (ADR-001) ([ed276d3](https://github.com/Artexis10/endstate-gui/commit/ed276d3dbf90740aa73d4352961ec5340cadab05))
* rename rebuild-engine.js to .cjs for ESM compatibility ([b9e5ddf](https://github.com/Artexis10/endstate-gui/commit/b9e5ddf31fcb79e7b80d357b0d455890f5be8128))
* Reports logs use persisted artifact paths instead of filename parsing ([b1d7c72](https://github.com/Artexis10/endstate-gui/commit/b1d7c72a13ef0aebf86e499ad32ca902362c531a))
* Reports show engine logs/events via runId and state discovery ([4a52929](https://github.com/Artexis10/endstate-gui/commit/4a52929460018dc3bb0f7bd0c28caf8d907b5b35))
* resolve 7 critical UX/state bugs (engine hang, navigation state, scrolling, truncation, status colors, partial failures, double-run) ([5563658](https://github.com/Artexis10/endstate-gui/commit/556365819c94a124f6ef3aa40b80c23547cab99a))
* resolve Capture/Apply regressions and add comprehensive UX contract tests ([d712f1f](https://github.com/Artexis10/endstate-gui/commit/d712f1f4090c784a294ca3f90cefe21c4b736fed))
* resolve critical GUI blockers before merge ([1a96bf4](https://github.com/Artexis10/endstate-gui/commit/1a96bf4b2a0afd4e10e97ba5a21c736d46374da9))
* restore original apply scroll, limit phase-aware tracking to verify ([4e12e0d](https://github.com/Artexis10/endstate-gui/commit/4e12e0d4713202d817b69a914378c8038e3cb235))
* restore profile manage actions, enable recapture, tighten profile selector spacing ([89dbd87](https://github.com/Artexis10/endstate-gui/commit/89dbd87e29ff4409e300818b8ba87ea0da38e616))
* restore UX consistency and Set up computer functionality ([41fd5f4](https://github.com/Artexis10/endstate-gui/commit/41fd5f4331ed815f91cac5ad105b78e3f3a17e91))
* restore UX consistency for dividers and Reports gating ([b4cec09](https://github.com/Artexis10/endstate-gui/commit/b4cec09c3233edb47a96cccf712aec2505b8301a))
* restore UX consistency for Reports run expansion and dividers ([9455014](https://github.com/Artexis10/endstate-gui/commit/9455014a1682b11b679ee4628554af11de4424d4))
* reuse Capture Details modal for View Apps and add profile deletion test ([d9693fc](https://github.com/Artexis10/endstate-gui/commit/d9693fcbbb4042d6d3e2c12a6f056a96c71d0981))
* revert formatAppIdentity CamelCase heuristic — engine sends real names ([d34ea88](https://github.com/Artexis10/endstate-gui/commit/d34ea886bca98cf5e3f76fffb703dc15e5ce330b))
* **runtime:** make engine test interface non-fatal + restore settings access ([09ee859](https://github.com/Artexis10/endstate-gui/commit/09ee859ce139e43e540275bbb96364a15f5a46b0))
* save profile opt-in and reports log visibility ([6cc8999](https://github.com/Artexis10/endstate-gui/commit/6cc89993f5f71951b6c49d8b1983a8f98df1cd43))
* save zip bundles when engine produces them, add web fallback for save dialog ([5e0e352](https://github.com/Artexis10/endstate-gui/commit/5e0e352689caac6920c435d4219712ac1fbf23c5))
* **save-profile:** enforce draft content invariant before write (INV-SAVE-1) ([7dbd31c](https://github.com/Artexis10/endstate-gui/commit/7dbd31c5239296d7ca367f8ad473d63d1758b99c))
* **save-profile:** write non-empty manifest and refresh profiles after save ([3eb43e8](https://github.com/Artexis10/endstate-gui/commit/3eb43e81b6c0308ed31afb4408939c398d09b265))
* Set ENDSTATE_ALLOW_DIRECT=1 for script mode + pluralize app counts ([432e897](https://github.com/Artexis10/endstate-gui/commit/432e8979ecd76e43080d048447f6677d1496369b))
* show friendly display names instead of Winget IDs in capture UI ([bccc5f6](https://github.com/Artexis10/endstate-gui/commit/bccc5f6057e9b3328dfa496ecd40336157dbe2a6))
* **streaming:** remove false failure check on invoke return value ([3359e49](https://github.com/Artexis10/endstate-gui/commit/3359e49994587af11f7120bfea070d06ef99a91f))
* strip \?\ extended path prefix from bundled engine paths ([9301891](https://github.com/Artexis10/endstate-gui/commit/9301891ef6c3e30d9f0cba40642217a5210f7919))
* sync @tauri-apps/api to match Rust tauri crate version ([97a4a80](https://github.com/Artexis10/endstate-gui/commit/97a4a8008af207a41ccc5b26bb6edc97e46293b9))
* Tauri file import — single-drop triple-import and missing profiles ([561f094](https://github.com/Artexis10/endstate-gui/commit/561f094bf5fa85789bbbf3005f5d19a81c2a9c1a))
* **tauri-bridge:** robust runtime detection and proper test mock handling ([80aa39b](https://github.com/Artexis10/endstate-gui/commit/80aa39b6320c567a4ef751e01c73508de903e885))
* **tauri-bridge:** use try-real-then-fallback instead of fragile detection ([6e841b3](https://github.com/Artexis10/endstate-gui/commit/6e841b3e114b398746bd88ecf9a95b0fe63408f0))
* **tests:** update failing tests to match current implementation ([b79386f](https://github.com/Artexis10/endstate-gui/commit/b79386f54976f5f08a6bc0c53405dc3dea3f00af))
* **toast:** Add dark theme for Contract E visual consistency ([2cd7a7a](https://github.com/Artexis10/endstate-gui/commit/2cd7a7a2b999d6b7bd260998870c6a30ec9736a2))
* **toast:** correct error semantics for draft vs profile missing (INV-3) ([9b64d8b](https://github.com/Artexis10/endstate-gui/commit/9b64d8bb52adedf27fd10fdab73192d7e2c4bcc8))
* **toast:** improve theming, swipe UX, and divider gating ([3912391](https://github.com/Artexis10/endstate-gui/commit/39123914d3cf20581f1df0fab12f822307703f0b))
* **toast:** restore reliable auto-dismiss + improve swipe UX ([637756a](https://github.com/Artexis10/endstate-gui/commit/637756a3f1796ed1c572cec585d11e398fdb32fa))
* ui card spacing ([32787a6](https://github.com/Artexis10/endstate-gui/commit/32787a6f22e554a16ed8263823b383ffa757f64b))
* update openspec skills to v1.1.1 and add command hints to completion messages ([444e67f](https://github.com/Artexis10/endstate-gui/commit/444e67fc485cb06561e5eb9b08fe0a0223a9cc76))
* updated gitignore to eliminate test results ([ed3c0db](https://github.com/Artexis10/endstate-gui/commit/ed3c0db594e6b724f5f1f4a859c95d373ceda552))
* UX improvements for Save Profile, Reports, and Profile Details ([ac78996](https://github.com/Artexis10/endstate-gui/commit/ac78996afa202723454803ce9c8432b26b645bc3))
* **ux:** apply modal copy, collapse technical details, responsive dialog ([1c87589](https://github.com/Artexis10/endstate-gui/commit/1c8758962ee011e1fcbcd24dd60b835d6d037638))
* **ux:** comprehensive UX polish for Default and Advanced modes ([5898ffa](https://github.com/Artexis10/endstate-gui/commit/5898ffab7ea5cac1b02cee734bacba2b0ccd0e5c))
* **ux:** enforce semantic status contract and fix modal correctness ([bb548ad](https://github.com/Artexis10/endstate-gui/commit/bb548ad2c9a0af35e042aff31ed8a179e3674f67))
* **ux:** fix capture save flow bugs and gate View log behind showDetails ([a65459e](https://github.com/Artexis10/endstate-gui/commit/a65459eb2038bce2cf768aeaa0b8ea3ed4c16469))
* **ux:** fix draft-capture save state correctness ([8350d2a](https://github.com/Artexis10/endstate-gui/commit/8350d2aa5efe5e56a9afd93b2f6ed6fa4231846a))
* **ux:** gate advanced controls behind Show details and fix save-from-capture flow ([032d5f7](https://github.com/Artexis10/endstate-gui/commit/032d5f787c370f6cdd4750b248d5b771a04f3ff7))
* **ux:** harden select contrast, folder modal, filters, and e2e for default+advanced ([ddc403e](https://github.com/Artexis10/endstate-gui/commit/ddc403ec373ff1c743672085683fc694b684c4d2))
* **ux:** hide profile filenames in simplified mode ([8ecb28d](https://github.com/Artexis10/endstate-gui/commit/8ecb28d60d95af6bf992e26796dd05a17b224195))
* **ux:** improve semantics - 'Check what will change' button, intent-based modal copy, unified Details list ([352fa75](https://github.com/Artexis10/endstate-gui/commit/352fa75723697b3fbc5b63c43565296f0593eec8))
* **ux:** make capture draft save robust + restore saved state + gate advanced details ([27fcb5a](https://github.com/Artexis10/endstate-gui/commit/27fcb5abdce382668b8e0943590f2de7970a4ced))
* **ux:** per-workflow Last Run, remove duplicated progress, phase-correct apply modal ([407cbae](https://github.com/Artexis10/endstate-gui/commit/407cbaed8eb3f3b2b22d304709f11044bd53b400))
* **ux:** Phase 3 UX semantics and visual coherence pass ([85377c8](https://github.com/Artexis10/endstate-gui/commit/85377c85dfc71159fad20d2ac7a61ff56db1de62))
* **ux:** profile select dark mode, live activity stability, and append-order semantics ([247fbdd](https://github.com/Artexis10/endstate-gui/commit/247fbdd38b1505a76dbaf4b6285344f7883a3593))
* **ux:** profile select styling, profiles folder open, card spacing, and profile names ([ebba377](https://github.com/Artexis10/endstate-gui/commit/ebba377bf14e784a8bda5c6893e3fbd8f5458a89))
* **ux:** readable profile selector, expose profiles folder, and clarify technical details toggle ([2fb8a48](https://github.com/Artexis10/endstate-gui/commit/2fb8a48307654fed1f100e63ea349dfe22f7e685))
* **ux:** Reports log viewer modal and Save Profile messaging ([cbde5db](https://github.com/Artexis10/endstate-gui/commit/cbde5db3b285b90f45375bc8426f5f4f69e9bf6a))
* **ux:** restore capture save state card and harden save flow ([6b50585](https://github.com/Artexis10/endstate-gui/commit/6b50585ac80fdd32763c8193ea5d98930d506692))
* **ux:** restore correct status semantics for verify Missing and streaming parsing ([7a92e2c](https://github.com/Artexis10/endstate-gui/commit/7a92e2c00277247852f55e841a5768c41bde83ee))
* **ux:** standardize Details setting, winget IDs, and in-app log viewer ([1c2566a](https://github.com/Artexis10/endstate-gui/commit/1c2566a04c272e6f21b233007118b52a47c03b61))
* **ux:** unify Details disclosure and persist global visibility setting ([821c0e6](https://github.com/Artexis10/endstate-gui/commit/821c0e6148145389415c2abdee90fc3f2a8eb358))
* **verify:** treat domain failures as results, not connection errors ([1cd1845](https://github.com/Artexis10/endstate-gui/commit/1cd1845c14dc296fe948c4a4bf9ebac77edea4b9))
* **view-apps-modal:** improve UX with overflow handling, copy feedback, and app identifier consistency ([625656a](https://github.com/Artexis10/endstate-gui/commit/625656abe5db37f4214bca78381ef45327a0c898))
* ViewAppsModal UX regressions - overflow, copy feedback, and app display ([7544e85](https://github.com/Artexis10/endstate-gui/commit/7544e854a17922bbe3a0b3d90d43b0cf152a76f0))


### Performance Improvements

* throttle streaming log updates and cap output ([4f7be00](https://github.com/Artexis10/endstate-gui/commit/4f7be006600462b5c6888ee9a3aeaf74ba65faba))


### Code Refactoring

* **ux:** unify workflow with progressive disclosure, remove global Advanced mode ([8501f2d](https://github.com/Artexis10/endstate-gui/commit/8501f2dffe9f8ea751138c6c54cad0e95c904e91))

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
- License activation via LemonSqueezy
- Advanced mode for technical details
- Engine schema compatibility handshake

### Changed

### Fixed

## [0.1.0] - 2026-03-05

### Added
- Initial release with semver versioning system

### Changed

### Fixed
