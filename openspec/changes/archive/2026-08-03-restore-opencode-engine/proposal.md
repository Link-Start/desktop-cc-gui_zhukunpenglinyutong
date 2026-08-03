# restore-opencode-engine

## Why

OpenCode CLI 在 2026-02 完整接入后，于 2026-06/07 被 soft-retire（`2026-07-18-2026-06-24-retire-opencode-and-gemini-cli` + `2026-07-26-enforce-opencode-soft-retirement-boundary`），当时的裁定理由是启用率低与维护成本。退役文档明确约定：若未来恢复产品入口，另开 change 重新评估——本 change 即该恢复评估。

当前用户需求反过来了：本机已安装并可正常使用 opencode CLI（1.4.6，`opencode run --format json` 事件信封与本仓库保留的 Rust adapter 假设一致，已实测），要求把 opencode 恢复到与 Kimi/Grok 同级的可用完备度，并补齐 vendor provider 管理面。

恢复的现实基础：

- Rust 侧 `engine/opencode.rs`（session 实现）、`commands_opencode.rs`（17 命令）、`status.rs::detect_opencode_status` / `load_opencode_models`、session 历史/删除兼容全部保留并通过编译与测试。
- 前端 `EngineType` union、`engineIds.json`、capability matrix、`OpenCodeGlyph`、`opencodeRealtimeAdapter`、`opencodeHistoryLoader`、composer `AVAILABLE_PROVIDERS` 条目均保留。
- 真正被 gate 的只有 8 处（Rust policy 3 处、前端 policy 4 处、retirement check 脚本 1 个），解除成本远低于重写。

## What Changes

- **解除 runtime policy gate**（BREAKING 相对现行退役策略）：`engine_enabled_in_settings(OpenCode)` 恢复为常驻启用（与 Kimi/Grok 一致，无 enable 开关）；`opencode_enabled` settings 字段降级为 legacy 兼容、不再参与 gate；`default_opencode_enabled() -> true`；`sanitize_engine_gates` 不再强制关闭。
- **删除 retirement 强制边界**：移除 `scripts/check-opencode-retirement.mjs` 及 package.json 条目；main spec `opencode-soft-retirement-boundary` 整体 REMOVED。
- **恢复前端入口**：`engineExecutionPolicy` / `engineControllerAvailability` / `useAppSettings` normalization / `useThreadActions` 历史水合默认 / `startupOwners` 启动注册恢复 opencode。
- **补齐 CLI 生命周期**：设置页 CLI validation 恢复 OpenCode tab；新增 `opencode_doctor`（binary 检测 + 默认 model 可用性检查）；`CliInstallEngine::OpenCode`（npm 包 `opencode-ai`，install / upgrade，不做 uninstall）。
- **模型选择**：以 `load_opencode_models`（`opencode models` 动态探测）为主，`generatedModelCatalog.json` opencode roster 为 fallback；GUI 发送时**始终显式传 `--model`**（本机默认 model 配置可能损坏，实测 `xaio/XAIO-C-4-5-Sonnet` not found）。
- **新增 vendor provider 管理**：`vendors/opencode_providers.rs` CRUD 命令族；provider profile 经 `OPENCODE_CONFIG_CONTENT` env 注入 opencode.json provider 配置（`@ai-sdk/openai-compatible` + baseURL + apiKey + models）；前端 vendor 面板新增 OpenCode tab；`PROVIDER_SCOPED_ENGINES` 加 opencode。
- 10 个 locale i18n 补齐（settings / providers / sidebar / workspace / runtimeNotice / git）。

## Capabilities

### New Capabilities

- `opencode-cli-lifecycle`: OpenCode CLI 的安装 / 升级 / doctor 诊断（含默认 model 可用性检查）。
- `opencode-vendor-providers`: OpenCode provider CRUD 与 `OPENCODE_CONFIG_CONTENT` 物化注入。

### Modified Capabilities

- `opencode-soft-retirement-boundary`: 整体 REMOVED——产品策略从 soft-retire 反转为常驻启用，retirement check 脚本与 fail-closed policy 一并移除。
- `engine-capability-matrix`: opencode 条目从 retired 兼容态恢复为 active（fixture 已存在，仅需校验一致性）。

### Restored Capabilities

- `opencode-engine`: 恢复为 active runtime——消息发送 / 块级事件流 + synthetic streaming / 中断 / session 续聊（`-s <id>`）/ 历史会话列表-加载-删除。

## Impact

- Affected code: `src-tauri/src/engine/{mod,status,manager,commands,opencode}.rs`、`src-tauri/src/types.rs`、`src-tauri/src/bin/cc_gui_daemon/**`（影子副本）、`src-tauri/src/codex/{doctor,installer,mod}.rs`、`src-tauri/src/vendors/**`、`src-tauri/src/session_management*.rs`、`src/utils/engineExecutionPolicy.ts`、`src/features/{engine,settings,vendors,threads,composer,models}/**`、`src/services/tauri/**`、`src/i18n/locales/*`、`scripts/check-opencode-retirement.mjs`（删除）、`scripts/check-model-provider-catalog.mjs`。
- APIs: 新增 Tauri 命令 `opencode_doctor` / `vendor_*_opencode_*`；`cli_install_plan` / `cli_install_run` 的 `engine` 接受 `"opencode"`；既有 `opencode_*` 17 命令从 fail-closed 恢复为可用。
- Data: provider 配置存 ccgui `config.json` 新 `opencode` section；运行时经 env 注入，不直接改用户 `~/.opencode` 配置。
- Compatibility: legacy `opencodeEnabled: false` 持久化值不再生效（升级后 opencode 默认可见）；Gemini 保持退役，不在本 change 范围。

## 目标与边界

- 目标：OpenCode 在对话、历史、设置、vendor 四个面达到与 Kimi/Grok 相同的可用完备度。
- 边界：常驻启用（无 enable 开关）；headless `opencode run --format json` auto-approve 模式，无审批弹窗；流式为块级事件 + 现有 synthetic streaming，不引入 `opencode serve` 架构。

## 非目标

- 不恢复 Gemini（仍退役）。
- 不实现 `opencode serve` / SSE / 权限审批交互（后续如需另开 change）。
- 不恢复 2026-07 已删除的 `OpenCodeControlPanel` / `useOpenCodeSelection` / `useOpenCodeThreadBinding` / `opencode-panel.css`（那些是旧控制面板形态，恢复走现行 engine 标准链路）。
- 不做 OpenCode uninstall（保护 `~/.opencode` 登录态与会话数据）。
