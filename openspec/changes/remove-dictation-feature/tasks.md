# remove-dictation-feature — tasks

## 1. Spec & 契约对齐

- [ ] 1.1 `openspec validate remove-dictation-feature --strict --no-interactive` 通过
- [x] 1.2 `client-startup-orchestration` delta 与实现同步（实现 PR 内核对）

## 2. PR-D1 前端全链

- [x] 2.1 Composer：`Composer.tsx` 删 props 类型（:352-364）、destructure（:651-663）、transcript effect（:2826-2862）、2 个 import；9 个 Composer 测试删 `dictationEnabled={false}` 传参
- [x] 2.2 layout 透传：`useLayoutNodes.tsx:1812-1824,1992-2004`、`layoutNodesTypes.ts:220,742-751,1237-1246`、`useAppShellLayoutNodesSection.tsx:244-246,280-285,442,1198-1199,1808-1809,1983,2364-2373`
- [x] 2.3 settings UI：`DictationSection.tsx` 整删；`SettingsView.tsx` 接线 5 处；`settingsViewAppearance.ts` / `useSettingsModalState.ts` union 删 `"dictation"`；`settingsViewConstants.ts` DICTATION_MODELS；`useAppSettings.ts:338-341` 默认值；`src/types/settings.ts:194-197`
- [x] 2.4 根装配 + `dictationSurfaceContext` 整域出账（同 PR 改齐）：`useAppShellRootComposition.ts`、`appShellDomainContexts.ts`（union/bag/OWNED_KEYS/3 处 DOMAIN_SELECTION）、`buildAppShellDomainContextSlices.ts:789-821`、`useAppShellDomainAssembly.ts:14,358-371`、`appShellDomainOwnershipGate.ts:46` freeze、`scripts/check-app-shell-runtime-contract.mjs:29`、5 个 domain 测试 + `appShellHostBoundaries.test.ts:131` + `app-shell.startup.test.tsx:357-369,1292`
- [x] 2.5 services/types：`services/tauri/dictation.ts` 整删 + `services/tauri.ts:315-323` re-export；`events.ts:341-343,527-538`；`types/misc.ts:11-38`；`startupOwners.ts:11-16`；`startupDiagnosticsTimelineProjection.ts:130`；`clientDocumentationData.ts:136,812,818`
- [x] 2.6 整目录删除：`src/features/dictation/`（5 文件）、`useDictationController.ts`、`utils/keys.ts`（matchesHoldKey 独属，先 grep 确认）、`utils/dictation.ts`
- [x] 2.7 i18n：10 locale `settings.ts` 各 ~37 条（先 grep 确认 `languageEnglish` 等语言名 key 无他处复用）、`runtimeNotice.ts` 2 处、`en/lockScreen.ts:91,111`、`vitest.setup.ts:366,632-642,774-810`
- [x] 2.8 CSS：`composer.part1.css:1163-1176,1227-1240,1260-1320`（`.composer-waveform*` / `.composer-dictation-*`）
- [x] 2.9 验收：`npm run check:app-shell:governance` + `npm run check:app-shell:runtime-contract` + `npm run typecheck` 绿；全量 `src/app-shell` vitest 未在本轮整包跑（受影响套件已绿）

## 3. PR-D2 Rust 后端

- [x] 3.1 `src-tauri/src/dictation/` 整目录 + `lib.rs:140`；`command_registry.rs:431-438` 8 命令不留半截
- [x] 3.2 `state.rs:9,40,207`；`types.rs:1277-1284,1719-1728,2059-2062,2494-2497`；`diagnostics_bundle.rs:233-234`；fixture 2 处（`git/commands_branch.rs:1287`、`git/pull_request_content.rs:381`）
- [x] 3.3 `Cargo.toml` 删 `cpal` / `whisper-rs` / `objc2-av-foundation`（`sha2` 保留）；`cargo check` 重整 lock
- [x] 3.4 `Entitlements.plist:5`、`Info.plist:12-13`、`infoplist/en.lproj/InfoPlist.strings:2`、`infoplist/zh-Hans.lproj/InfoPlist.strings:2`
- [x] 3.5 兼容性实测：旧 settings.json 残留 dictation 4 keys 能正常反序列化启动
- [ ] 3.6 验收：`cd src-tauri && cargo check && cargo clippy && cargo test` 全绿

## 4. 收口

- [x] 4.1 回写 `docs/plans/app-shell-ownership-matrix.md`（dictationSurface 域删除、计数刷新）
- [x] 4.2 回写 `docs/plans/2026-08-11-app-shell-cohesion-optimization.md` §1.1 + §10 Log
- [ ] 4.3 `openspec validate --all --strict --no-interactive` 通过后走 verify / sync / archive
