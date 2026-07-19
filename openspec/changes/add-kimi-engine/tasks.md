# add-kimi-engine tasks

## 1. Rust 引擎核心（P1）

- [x] 1.1 [P0] `engine/kimi.rs`：`KimiSession` 全套（build_command / send_message NDJSON 解析 / interrupt / interrupt_turn / Drop）+ 6 个 parser 单测；model 透传不 sanitize。
- [x] 1.2 [P0] `engine/mod.rs`：`EngineType::Kimi`（serde `"kimi"`）、display_name "Kimi CLI"、icon "kimi"、`EngineFeatures::kimi()`（streaming/tools_control/session_resume = true）、常驻启用。
- [x] 1.3 [P0] `engine/status.rs`：`detect_kimi_status` / `get_kimi_home_dir`（`KIMI_CODE_HOME` 感知）/ `get_kimi_models`（解析 config.toml `[models.*]` + `default_model` + env fallback）；`detect_all_engines` / `detect_preferred_engine` / `resolve_engine_type` 接 `kimi_bin`。
- [x] 1.4 [P0] `engine/manager.rs` + `engine/commands.rs`：kimi_sessions map、`engine_send_message` / `engine_send_message_sync` / `engine_interrupt` / `engine_interrupt_turn` / `get_engine_models` 的 Kimi 臂（thread 前缀 `kimi:` / `kimi-turn-` / `kimi-item-`）。
- [x] 1.5 [P0] `engine/capability_matrix.rs` + `openspec/specs/engine-capability-matrix/fixtures/matrix.json` + `scripts/check-engine-capability-matrix.mjs`：kimi 条目。
- [x] 1.6 [P0] `types.rs`：`AppSettings.kimi_bin`（serde `kimiBin`）；`workspaces/commands.rs` / `shared_sessions.rs` / `engine/events.rs` 的 Kimi 臂。
- [x] 1.7 [P0] daemon 影子副本（`cc_gui_daemon/engine_bridge.rs` / `daemon_state.rs` / `cc_gui_daemon.rs`）全量同步；`cargo check` 双 target 全绿。

## 2. Kimi 历史会话（P2）

- [x] 2.1 [P0] `engine/kimi_history.rs`：list（session_index.jsonl 按 workDir variants 匹配 + join state.json）/ load（wire.jsonl → user/assistant/reasoning/tool messages + usage 聚合）/ delete（删 sessionDir + 重写 index）；5 个单测。
- [x] 2.2 [P0] `session_history_commands.rs` 三命令（含 remote bridge 分支）+ `command_registry.rs` 注册 + daemon 分发臂。
- [x] 2.3 [P1] 统一 session catalog：`session_management_catalog_projection.rs` kimi source、`session_management.rs` 全局目录 + 批量删除 kimi 臂、`SessionCatalogIdentity::Kimi`（`kimi:` 前缀解析）、auto-compaction 排除 kimi thread。

## 3. CLI 生命周期（P3）

- [x] 3.1 [P0] `codex/installer.rs`：`CliInstallEngine::Kimi`（`@moonshot-ai/kimi-code@latest`）+ `CliInstallAction::Uninstall`（command_preview / resolve_installer_command / warnings 按 action 分支；uninstall 跳过 post-install doctor）。
- [x] 3.2 [P0] `codex/doctor.rs`：`run_kimi_doctor_with_settings`（binary 检测 + `kimi doctor` 自检，结构化诊断字段与 claude 对齐）+ `kimi_doctor` 命令注册（含 daemon 分发）。
- [x] 3.3 [P0] 前端：设置页 CLI validation Kimi tab（路径输入 / doctor / 安装 / 升级 / 卸载按钮）+ `SettingsView` 状态接线 + `useAppSettings.kimiDoctor` + 10 locale i18n key。
- [x] 3.4 [P1] `src/types/diagnostics.ts`（`kimi` / `uninstall`）与 `src/services/tauri/doctor.ts::runKimiDoctor`（含 `services/tauri.ts` barrel 导出）。

## 4. Vendor provider 管理（P4）

- [x] 4.1 [P0] `types.rs::KimiProviderConfig` + `vendors/kimi_providers.rs` 七命令族：provider 存 ccgui config.json `kimi` section；switch 物化 `~/.kimi-code/config.toml`（`ccgui:` / `ccgui/` 命名空间 + `.bak` 备份 + 原子写）；`__local_config_toml__` 伪 provider；delete 时清理 config.toml 悬挂条目。
- [x] 4.2 [P0] 前端：`VendorTab` 加 "kimi"、`KimiProviderConfig` TS 类型、`KIMI_PROVIDER_PRESETS`（Kimi Code 官方 / Moonshot 开放平台 / custom）、`useKimiProviderManagement` hook、`KimiProviderDialog` / `KimiProviderList`、`cliEngineNav` kimi 转 supported、`VendorSettingsPanel` kimi 面板、vendor i18n key。

## 5. 前端引擎接线（P5）

- [x] 5.1 [P0] `src/types/engine.ts` + `useEngineController` + `engineAvailability` + `EngineIcon`（`@lobehub/icons-static-svg/icons/kimi.svg`）+ `runtimeMode.ts`。
- [x] 5.2 [P0] `kimiRealtimeAdapter` + registry + `sharedRealtimeAdapter.inferEngineFromThreadId` + `useThreadItemEvents` 的 `kimi:` / `kimi-pending-` 前缀 + `ConversationEngine` 类型。注：ComposerInput 的 accessMode 选项对 kimi 保持禁用（kimi `-p` 模式固定 auto 权限策略，Rust 臂忽略 access_mode）。
- [x] 5.3 [P0] `kimiHistoryLoader` + parser（含单测）+ `services/tauri/session.ts` 三封装。
- [x] 5.4 [P1] i18n：10 locale `workspace.ts` 的 `engineKimi` 等 key。
- [x] 5.5 [P0] composer 模型选择器 Kimi 分组（用户冒烟发现缺失）：`ChatInputBox/types.ts::AVAILABLE_PROVIDERS` 加 kimi 条目；`ChatInputBoxAdapter.tsx` 的 `providerAvailability` / `providerStatusLabels` / `providerVersions` 三 map 补 kimi 键；10 locale `providers.ts` 补 `providers.kimi.label`。模型目录链路（`engineModelCatalogsAsOptions` → `providerModelCatalogs`）本身按 engine status 通用生成，无需改动。
- [x] 5.6 [P0] 模型选择器跨引擎激活修复（用户冒烟发现：点 Kimi 分组模型仍停留 Claude Code / Opus 4.8）：`ChatInputBoxAdapter.tsx` 的 `ChatInputProvider` / `engineToProvider` / `providerToEngine` / `attachmentsToImageInputs` provider union 补 `kimi` 映射——此前 `providerToEngine('kimi')` 落 `default` 返回 `'claude'`，`handleProviderSelect` 判 `targetEngine === selectedEngine` early return，引擎从未切换。`useAppShellComposerModelSection.ts::handleSelectModel` 增加跨引擎目录回退：当前引擎目录查不到时从 `providerModelCatalogs` 解析 owning engine，选择写入目标引擎的 per-engine selection + `persistComposerEnginePref`，避免引擎异步切换期间选择被旧引擎目录校验静默丢弃（gemini 跨分组选择同类问题同修）。回归测试：`ChatInputBoxAdapter.test.tsx` +2 条、新增 `useAppShellComposerModelSection.test.tsx` 3 条。

## 6. 验证与收尾（P6）

- [x] 6.1 [P0] OpenSpec change 目录（proposal / tasks）。
- [x] 6.2 [P0] `cargo test`（src-tauri 全量 1427+890 绿）、`npm run typecheck`、`npm run lint`、受影响 vitest suites（2779/2781；2 个失败均为 HEAD 存量：BasicAppearanceSection 硬编码隐藏、moonshot.svg title 漂移，均不在本次 diff）。
- [x] 6.3 [P0] contract scripts：`check-branding.mjs`、`check-engine-capability-matrix.mjs`、`scan-engine-name-branches.mjs`、`check-app-shell-runtime-contract.mjs` 全绿。
- [x] 6.4 [P1] 冒烟：真实 CLI 验证（`kimi doctor` OK；`-p` stream-json 的 assistant/tool_calls/tool/meta 四类行与 parser 逐字吻合；`--session`/`--model` flag 与 `--help` 一致；`-p` 模式 auto 权限无需审批）；`tauri dev` 启动冒烟（vite :1420 + cc-gui 进程稳定运行无崩溃）。GUI 内点击级验证（引擎切换发消息、vendor switch 后查 config.toml）需人工过一遍。

## 7. Kimi 会话身份收敛修复（P7）

- [x] 7.1 [P0] 添加 frontend regression：history canonical row 先到时，`kimi-pending-*` promotion 必须合并为单 row，并迁移 active turn / processing / selection。
- [x] 7.2 [P0] 添加 Rust regression：新 Kimi turn 在真实 `session.resume_hint` 到达前不得返回 fabricated canonical `sessionId`。
- [x] 7.3 [P0] 修复 backend Kimi send contract，以 CLI 真实 `session_*` 作为唯一 canonical identity。
- [x] 7.4 [P0] 修复 frontend reconciliation：canonical row 已记录 pending alias 后，stale history snapshot 不得重新插入 matching pending row。
- [x] 7.5 [P0] 运行 focused Vitest、Rust test、`npm run typecheck`、`npm run lint`、runtime contracts 与 strict OpenSpec validation。

## 8. Kimi queued delta 二次收敛（P8）

- [x] 8.1 [P0] 基于 `diagnostics.threadSessionLog` 还原真实顺序：pending TextDelta 先入队，`thread/started` 先 promotion，旧 delta 后 flush 并重建 pending row。
- [x] 8.2 [P0] 添加 realtime regression：queued Kimi pending delta 在 flush 时必须动态解析 canonical alias。
- [x] 8.3 [P0] 添加 reducer regressions：`ensureThread` 不得重建 replaced pending id；history refresh 不得保留带 processing/item anchor 的 promoted residual。
- [x] 8.4 [P0] 在 `useThreadItemEvents` shared apply boundary canonicalize thread id，并以 `nativeThreadIds` 作为 reducer tombstone。
- [x] 8.5 [P0] 运行受影响 Vitest、`npm run typecheck`、`npm run lint`、runtime contracts 与 strict OpenSpec validation。
