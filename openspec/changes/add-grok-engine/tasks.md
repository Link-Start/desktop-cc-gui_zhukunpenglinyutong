# add-grok-engine tasks

## 1. Rust 引擎核心（P1）

- [x] 1.1 [P0] `engine/grok.rs`：`GrokSession` 全套（build_command / send_message NDJSON 解析 `text`/`thought`/`end`/`error` / interrupt / interrupt_turn / Drop）+ parser 单测；新会话 `-s <uuid>`、续聊 `-r`、env `GROK_HOME` + `GROK_DISABLE_AUTOUPDATER=1`。
- [x] 1.2 [P0] `engine/mod.rs`：`EngineType::Grok`（serde `"grok"`）、display_name "Grok CLI"、icon "grok"、`EngineFeatures::grok()`（streaming/tools/session_resume 同 kimi，mcp=false）、常驻启用。
- [x] 1.3 [P0] `engine/status.rs`：`detect_grok_status` / `get_grok_home_dir`（`GROK_HOME` 感知）/ `get_grok_models`（解析 config.toml `[model.*]` + `[models].default` + generated catalog fallback）；`detect_all_engines` / `resolve_engine_type` / `public_models_for_engine` 接 `grok_bin`。
- [x] 1.4 [P0] `engine/manager.rs` + `engine/commands.rs`：grok_sessions map（runtime key 隔离 provider）、`engine_send_message` / `engine_send_message_sync` / `engine_interrupt` / `engine_interrupt_turn` / `get_engine_models` 的 Grok 臂（thread 前缀 `grok:` / `grok-pending-`）。
- [x] 1.5 [P0] `engine/adapter_registry.rs` + `engine/events.rs` + `engine/capability_matrix.rs` + `openspec/specs/engine-capability-matrix/fixtures/matrix.json` + `scripts/check-engine-capability-matrix.mjs`：grok 条目。
- [x] 1.6 [P0] `types.rs`：`AppSettings.grok_bin`（serde `grokBin`）；`workspaces/commands.rs` / `engine/events.rs` 的 Grok 臂。
- [x] 1.7 [P0] daemon 影子副本（`cc_gui_daemon/engine_bridge.rs` / `daemon_state.rs`）全量同步；`cargo check` 双 target 全绿。

## 2. Grok 历史会话（P2）

- [x] 2.1 [P0] `engine/grok_history.rs`：list（遍历 `sessions/<encoded-cwd>/`，decode + canonicalize 匹配 workspace，读 `summary.json`）/ load（`chat_history.jsonl` → user(剥 `<user_query>`、跳 synthetic)/assistant(+tool_calls)/reasoning/tool_result）/ delete（删 session dir）；单测。
- [x] 2.2 [P0] `session_history_commands.rs` 三命令（含 remote bridge 分支）+ `command_registry.rs` 注册 + daemon 分发臂。
- [x] 2.3 [P1] 统一 session catalog：`session_management_catalog_projection.rs` grok source、`session_management.rs` 批量删除 grok 臂、`SessionCatalogIdentity::Grok`（`grok:` 前缀解析）、auto-compaction 排除 grok thread。

## 3. CLI 生命周期（P3）

- [x] 3.1 [P0] `codex/installer.rs`：`CliInstallEngine::Grok`（官方脚本 install/upgrade；不做 uninstall）。
- [x] 3.2 [P0] `codex/doctor.rs`：`run_grok_doctor_with_settings`（binary 检测 + `grok doctor` 自检）+ `grok_doctor` 命令注册（含 daemon 分发）。
- [x] 3.3 [P0] 前端：设置页 CLI validation Grok tab（路径输入 / doctor / 安装 / 升级按钮，无卸载）+ `SettingsView` 状态接线 + `useAppSettings.grokDoctor` + 10 locale i18n key。
- [x] 3.4 [P1] `src/types/diagnostics.ts` 与 `src/services/tauri/doctor.ts::runGrokDoctor`（含 barrel 导出）。

## 4. Vendor provider 管理（P4）

- [x] 4.1 [P0] `types.rs::GrokProviderConfig`（kimi 字段 + `apiBackend`）+ `vendors/grok_providers.rs` 七命令族：provider 存 ccgui config.json `grok` section；switch 物化 `~/.grok/config.toml`（`[model."ccgui/<name>"]` + `[models] default` + `.bak` 备份 + 原子写）；`__local_config_toml__` 伪 provider；delete 清理悬挂条目；`app_paths::grok_provider_homes_dir` + `engine/grok_provider_profile.rs`（runtime key `grok::{ws}::{profile}`）。
- [x] 4.2 [P0] 前端：`VendorTab` 加 "grok"、`GrokProviderConfig` TS 类型、`GROK_PROVIDER_PRESETS`（xAI 官方 / custom）、`useGrokProviderManagement` hook、`GrokProviderDialog`（含 apiBackend 三选一）/ `GrokProviderList`、`cliEngineNav` grok 转 supported、`VendorSettingsPanel` grok 面板、vendor i18n key、sidebar provider 选择（`grokLastProviderProfileId` + `new-session-grok`）。

## 5. 前端引擎接线（P5）

- [x] 5.1 [P0] `src/types/engine.ts` + `engineIds.json` + `engineExecutionPolicy.ts` + `EngineIcon`（`@lobehub/icons-static-svg/icons/grok.svg`）+ 各 inline union（conversationCurtainContracts / kanban contextMode / quick-switcher / conversation / runtime / diagnostics / messagesTypes / tasks）。
- [x] 5.2 [P0] `grokRealtimeAdapter` + registry + `useAppServerEvents` 的 `grok:` / `grok-pending-` 前缀与 engineHint union；ComposerInput accessMode 对 grok 保持禁用。
- [x] 5.3 [P0] `grokHistoryLoader` + parser（含单测）+ `services/tauri/session.ts` 三封装 + historyLoaderFactory / useThreadActionsResumeThread 接线。
- [x] 5.4 [P1] i18n：10 locale `workspace.ts` / `providers.ts` / `settings.ts` / `sidebar.ts` / `runtimeNotice.ts` 的 grok key + `vitest.setup.ts` mock。
- [x] 5.5 [P0] composer 模型选择器 Grok 分组：`AVAILABLE_PROVIDERS` + `ChatInputBoxAdapter` 的 availability/statusLabels/versions/enable map + `engineToProvider`/`providerToEngine` 映射（吸取 kimi 5.5/5.6 教训一次补全）；`generatedModelCatalog.json` grok roster。

## 6. 验证与收尾（P6）

- [x] 6.1 [P0] check 脚本更新：`check-engine-adapter-registry.mjs` / `check-engine-capability-matrix.mjs` / `check-model-provider-catalog.mjs`（+ 必要时 `check-branding.mjs` allowlist）；重新生成 capability matrix artifacts。
- [x] 6.2 [P0] `cargo test` 全量 + daemon `cargo check`、`npm run typecheck`、`npm run lint`、受影响 vitest suites 全绿。
- [x] 6.3 [P0] contract scripts 全绿 + `openspec validate --all --strict --no-interactive`。
- [ ] 6.4 [P1] 冒烟：真实 CLI 验证已完成（`-s` 预生成 UUID 开会话 / `-r` 续跑带上下文 / streaming-json 事件与 parser 逐字吻合 / `grok doctor` 可运行）；`tauri dev` 启动冒烟与 GUI 点击级验证（引擎切换发消息、续聊、历史加载、vendor switch 查 config.toml）需人工过一遍。
