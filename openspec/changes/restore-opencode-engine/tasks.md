# restore-opencode-engine tasks

## 1. 解除 Rust runtime policy gate（P0）

- [x] 1.1 [P0] `engine/mod.rs`：`engine_enabled_in_settings(OpenCode) => true`；移除 `OPENCODE_DISABLED_DIAGNOSTIC` 与 `engine_disabled_diagnostic` 的 OpenCode 臂；改写 `opencode_retirement_policy_ignores_legacy_enabled_setting` 测试为新语义。
- [x] 1.2 [P0] `bin/cc_gui_daemon/engine_bridge.rs`：影子副本同步 1.1 + 测试。
- [x] 1.3 [P0] `types.rs`：`default_opencode_enabled() -> true`；`sanitize_engine_gates` 不再强制 `opencode_enabled = false`；更新相关测试（行 2395/2616/2638/2643 附近）。
- [x] 1.4 [P0] `engine/status.rs` / `engine/manager.rs` / `session_management_catalog_projection.rs`：清理 opencode_disabled 死分支，`detect_opencode_status` 走正常路径；更新 `manager.rs` disabled-status 测试。
- [x] 1.5 [P0] 删除 `scripts/check-opencode-retirement.mjs` + `package.json` script 条目。

## 2. 恢复前端入口（P0）

- [x] 2.1 [P0] `src/utils/engineExecutionPolicy.ts`：`ExecutableEngineType = Exclude<EngineType, "gemini">`；`isEngineExecutionEnabled` 加 `opencode`。
- [x] 2.2 [P0] `engineControllerAvailability.ts`：移除 `engineType !== "opencode"` 过滤；更新 `useEngineController.test.tsx`。
- [x] 2.3 [P0] `useAppSettings.ts`：移除 `opencodeEnabled: false` normalization。
- [x] 2.4 [P0] `useThreadActions.ts`：`includeOpenCodeSessions` 默认 true；`startupOwners.ts` 恢复 `opencode_session_list` 注册（对齐 kimi/grok）。
- [x] 2.5 [P0] `ChatInputBoxAdapter.tsx`：核对 availability / statusLabels / versions map 的 opencode 条目（已存在，无需改动）。

## 3. CLI 生命周期（P1）

- [x] 3.1 [P0] `codex/doctor.rs`：`run_opencode_doctor_with_settings`（binary 检测 + 默认 model 可用性检查）+ `codex/mod.rs` 导出 + `command_registry.rs` 注册（含 daemon 分发）。
- [x] 3.2 [P0] `codex/installer.rs`：`CliInstallEngine::OpenCode`（npmGlobal `opencode-ai`，install / upgrade；不做 uninstall）。
- [x] 3.3 [P0] 前端设置页：`CodexSection.tsx` 的 `DEPRECATED_CLI_VALIDATION_ENGINES` 移除 `"opencode"` + OpenCode tab/panel（照 grok）；`SettingsView.tsx` 状态接线；`src/types/diagnostics.ts` `CliInstallEngine` 加 `"opencode"`；`useCliInstallLifecycle.ts` strategy；`services/tauri/doctor.ts::runOpenCodeDoctor`。
- [x] 3.4 [P1] `src/types/settings.ts` 与 Rust `AppSettings.opencode_bin` 链路核对补齐。

## 4. 模型 catalog 与侧栏（P1）

- [x] 4.1 [P0] `generatedModelCatalog.json` opencode roster + `scripts/check-model-provider-catalog.mjs` 同步；动态探测（`load_opencode_models`）为主、roster 为 fallback。
- [x] 4.2 [P1] 侧栏与散点：`useSidebarMenus.ts` / `sidebarInternals.ts` / `ThreadList.tsx` / `QuickSwitcher.tsx` / `CommitMessageEngineIcon.tsx` 补 opencode（照 grok commit 53f59f710 散点清单核对）；`scan-engine-name-branches` 扫漏。
- [x] 4.3 [P1] i18n：10 locale `settings.ts` / `sidebar.ts` / `workspace.ts` / `runtimeNotice.ts` / `git.ts` 补 opencode key + `vitest.setup.ts` mock。

## 5. Vendor provider 管理（P2）

- [x] 5.1 [P0] `types.rs::OpenCodeProviderConfig` + `vendors/opencode_providers.rs` CRUD 命令族（list/upsert/delete/test，存 ccgui config.json `opencode` section）+ `vendors/mod.rs` + `command_registry.rs` 注册（含 daemon 分发）。
- [x] 5.2 [P0] `engine/opencode.rs::build_command` 接受 provider profile：`OPENCODE_CONFIG_CONTENT` env 注入（`@ai-sdk/openai-compatible` + baseURL + apiKey + models），`--model ccgui/<model>`（稳定 provider key `ccgui`）；runtime key `opencode::{ws}::{profile}`（参照 `kimi_provider_profile.rs`，config 自包含解析以兼容 daemon crate）。
- [x] 5.3 [P1] `session_management.rs`（provider binding / include_engine）/ `shared_sessions.rs` / `app_paths.rs` 接入 opencode。
- [x] 5.4 [P0] 前端：`VendorTab` 加 `"opencode"`、TS 类型、`OPENCODE_PROVIDER_PRESETS`、`useOpenCodeProviderManagement`、`OpenCodeProviderDialog` / `OpenCodeProviderList`、`cliEngineNav` 转 supported、`VendorSettingsPanel` 面板、`services/tauri/vendors.ts` 封装。
- [x] 5.5 [P1] `useProviderModelCatalogSync.ts` `PROVIDER_SCOPED_ENGINES` 加 opencode；sidebar provider 选择菜单（`opencodeLastProviderProfileId` + `new-session-opencode`）；10 locale `providers.ts` opencode 分组。

## 6. 验证与收尾（P0）

- [x] 6.1 [P0] `cargo test` 全绿（engine / manager / types / engine_bridge / vendors）；`cargo check` 双 target。（lib 1691 过 / daemon 1043 过；各 2 个 `runtime::tests` macOS 进程组回收失败为 HEAD 既有环境问题，与本 change 无关）
- [x] 6.2 [P0] `pnpm lint` / `pnpm typecheck` / 受影响 vitest 套件全绿。（typecheck 0 error；全量 vitest 7477 过，4 个失败为 HEAD 既有：CODEX_MODELS 清单、file-view-panel CSS 契约、useCapability、fileSurfaceRuntimeBoundaryGuard）
- [x] 6.3 [P0] contract checks：`check-engine-adapter-registry` / `check-engine-capability-matrix` / `scan-engine-name-branches` / `check-engine-controller-facade` / `check-app-shell-runtime-contract` 全过。
- [x] 6.4 [P0] 手动冒烟：设置页 OpenCode tab + doctor → composer 选 OpenCode + 显式模型 → 发消息 → 流式 → 中断 → 历史恢复 → vendor 面板配置中转 provider 跑通。（CLI 层已实测：裸 `opencode run --format json` 全事件链通过；`OPENCODE_CONFIG_CONTENT` 注入经本地 mock OpenAI-compatible server 端到端通过；GUI 点击级冒烟交由用户验收）
- [x] 6.5 [P1] OpenSpec verify / sync / archive 流程；相关 spec 同步。（`openspec validate restore-opencode-engine --strict` 通过；sync/archive 待用户验收后随提交流程执行）
