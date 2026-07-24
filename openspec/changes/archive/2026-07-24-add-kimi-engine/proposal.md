# add-kimi-engine

## Why

ccgui 当前支持 Claude Code / Codex / Gemini / OpenCode 四个 CLI 引擎，Kimi CLI（`@moonshot-ai/kimi-code`）已在项目中预留空入口但无任何实现。Kimi CLI 的 headless 协议（`kimi -p --output-format stream-json`，NDJSON）与 Gemini CLI 同构（spawn-per-turn + stream-json），具备与现有引擎对齐接入的条件。用户需要：

- 在对话中选择 Kimi 引擎发消息、续聊历史 session。
- 浏览 / 加载 / 删除本机 Kimi 历史会话。
- 在设置页完成 Kimi CLI 的安装、升级、**卸载**、版本检测与 doctor 诊断。
- 在 vendor 面板管理 Kimi provider（API Key / base_url / model），切换时物化到 `~/.kimi-code/config.toml`。

## What Changes

- 新增 `EngineType::Kimi`（serde `"kimi"`）全链路：engine 检测（`kimi --version` + `KIMI_CODE_HOME`）、session 管理（`KimiSession`，NDJSON 解析 assistant/tool_calls/tool_result/session.resume_hint）、interrupt、capability matrix、daemon 影子副本同步。
- 新增 `engine/kimi_history.rs`：读取 `~/.kimi-code/session_index.jsonl` + `sessions/<wdKey>/<sid>/state.json` + `agents/main/wire.jsonl`，提供 `list_kimi_sessions` / `load_kimi_session` / `delete_kimi_session` 三个命令（含 remote daemon 分发与统一 session catalog 投影）。
- CLI 生命周期：`CliInstallEngine::Kimi`（npm 包 `@moonshot-ai/kimi-code@latest`）+ 新增 `CliInstallAction::Uninstall`（`npm uninstall -g`，三个引擎通用）；`kimi_doctor` 命令（binary 检测 + `kimi doctor` 自检）；设置页 CLI validation 新增 Kimi tab 与各引擎「卸载」按钮。
- Vendor provider 管理：`vendors/kimi_providers.rs` 七命令族，provider 存 ccgui `config.json` 的 `kimi` section；切换时以 `ccgui:`/`ccgui/` 命名空间物化进 `~/.kimi-code/config.toml`（写前备份 `.bak`），`__local_config_toml__` 伪 provider 表示不动 config.toml；前端 vendor 面板新增 Kimi tab。
- 前端引擎接线：`EngineType` 加 `"kimi"`、`kimiRealtimeAdapter`、history loader/parser、`kimi:` / `kimi-pending-` thread id 前缀、EngineIcon（`@lobehub/icons-static-svg/icons/kimi.svg`）、10 个 locale 的 i18n key。

## Capabilities

### New Capabilities

- `kimi-engine-runtime`: Kimi CLI 作为第五引擎的消息发送 / 流式渲染 / 中断 / session 续聊。
- `kimi-session-history`: Kimi 历史会话的列表 / 加载 / 删除，接入统一 session catalog。
- `kimi-cli-lifecycle`: Kimi CLI 的安装 / 升级 / 卸载 / doctor 诊断。
- `kimi-vendor-providers`: Kimi provider CRUD 与 `config.toml` 物化切换。

### Modified Capabilities

- `engine-capability-matrix`: matrix fixture 与 Rust 推导增加 kimi 条目（streaming/tools/session_resume = supported；MCP / reasoning effort / collaboration / image input = unsupported）。

## Impact

- Affected code: `src-tauri/src/engine/**`、`src-tauri/src/codex/{installer,doctor,mod}.rs`、`src-tauri/src/vendors/**`、`src-tauri/src/session_management*.rs`、`src-tauri/src/bin/cc_gui_daemon/**`（影子副本）、`src/features/{settings,vendors,threads,engines}/**`、`src/services/tauri/**`、`src/i18n/locales/*`。
- APIs: 新增 Tauri 命令 `list_kimi_sessions` / `load_kimi_session` / `delete_kimi_session` / `kimi_doctor` / `vendor_*_kimi_*`；`cli_install_plan` / `cli_install_run` 的 `engine` 接受 `"kimi"`、`action` 接受 `"uninstall"`。
- Data: 只读写 `~/.kimi-code/**` 与 ccgui `config.json` 的新 `kimi` key；旧 key 不受影响；config.toml 写前自动备份 `.bak`。
- Compatibility: 未安装 Kimi CLI 时引擎显示 not-installed 诊断，不影响其他引擎。

## 目标与边界

- 目标：Kimi 引擎在对话、历史、设置、vendor 四个面达到与 Claude/Codex 相同的可用完备度。
- 边界：Kimi 引擎常驻启用（不加 enable 开关）；session id 只从流式输出捕获（CLI 不支持外部指定）；`-p` headless 强制 auto 权限，无审批交互。

## 非目标

- 不实现 Kimi 的 shared session（仅 Claude/Codex 支持）。
- 不解析 wire.jsonl 中的 `llm.request` / subagent 事件；history 只还原 user / assistant / reasoning / tool 主线。
- 不做 Kimi pricing / context-ledger 成本核算（pricing fixture 未知，后续单独补）。
- 不引入 `kimi` 字面值分支扫描（`scan-engine-name-branches.mjs` 当前只扫四引擎，kimi 分支暂不纳入）。

## 风险

- `config.toml` 物化若与用户手改冲突：以 `ccgui:` 命名空间隔离 + `.bak` 备份 + 原子写（tmp + rename）兜底。
- wire.jsonl 行类型随 kimi 版本演进：parser 对未知行类型一律 skip，最坏情况是历史少展示内容，不会报错。
- npm 卸载全局包需要与安装一致的 PATH 解析：复用现有 `resolve_installer_command` 的 `build_codex_path_env` 机制。
