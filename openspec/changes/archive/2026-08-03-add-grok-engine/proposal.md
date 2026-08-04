# add-grok-engine

## Why

ccgui 当前支持 Claude Code / Codex / Kimi 三个可用 CLI 引擎（Gemini / OpenCode 已 soft-retire）。Grok CLI（xAI 官方 coding agent，binary `grok`，headless 协议 `grok -p --output-format streaming-json`，NDJSON）与 Kimi 的 one-shot stream-json 模式同构（spawn-per-turn），且在 `cliEngineNav.tsx` 中已预留 grok 占位入口（icon + docs URL，标记 unsupported）。用户需要：

- 在对话中选择 Grok 引擎发消息、续聊历史 session。
- 浏览 / 加载 / 删除本机 Grok 历史会话。
- 在设置页完成 Grok CLI 的安装、升级、版本检测与 doctor 诊断。
- 在 vendor 面板管理 Grok provider（API Key / base_url / model / api_backend），切换时物化到 `~/.grok/config.toml`。

## What Changes

- 新增 `EngineType::Grok`（serde `"grok"`）全链路：engine 检测（`grok --version` + `GROK_HOME`）、session 管理（`GrokSession`，NDJSON 解析 `text` / `thought` / `end` / `error` 四类事件）、interrupt、capability matrix、daemon 影子副本同步。
- 会话身份：新会话由 backend 预生成 UUID 并以 `grok -s <uuid>` 开会话（CLI 原生支持调用方指定新会话 UUID），续聊用 `grok -r <uuid>`；thread id 前缀 `grok:` / `grok-pending-`。canonical identity 在 turn 启动即确定，**不需要** kimi 那套 pending→canonical promotion。
- 新增 `engine/grok_history.rs`：遍历 `$GROK_HOME/sessions/<url-encoded-cwd>/<uuid>/`（cwd canonicalize 后匹配），读 `summary.json` 列表、`chat_history.jsonl` 还原消息，提供 `list_grok_sessions` / `load_grok_session` / `delete_grok_session` 三个命令（含 remote daemon 分发与统一 session catalog 投影）。
- CLI 生命周期：`CliInstallEngine::Grok`（官方脚本 `curl -fsSL https://x.ai/cli/install.sh | bash`，install / upgrade）；`grok_doctor` 命令（binary 检测 + `grok doctor` 自检）；设置页 CLI validation 新增 Grok tab。**不提供 uninstall**（避免误删 `~/.grok` 登录态与会话数据）。
- Vendor provider 管理：`vendors/grok_providers.rs` 七命令族，provider 存 ccgui `config.json` 的 `grok` section；切换时以 `ccgui/` 命名空间物化进 `~/.grok/config.toml`（`[model."ccgui/<name>"]` + `[models] default`，写前备份 `.bak`），`__local_config_toml__` 伪 provider 表示不动 config.toml；provider 会话使用独立 `GROK_HOME`（`app_paths::grok_provider_homes_dir()`）；前端 vendor 面板新增 Grok tab。
- 前端引擎接线：`EngineType` 加 `"grok"`、`grokRealtimeAdapter`、history loader/parser、`grok:` / `grok-pending-` thread id 前缀、EngineIcon（`@lobehub/icons-static-svg/icons/grok.svg`）、composer provider 映射、10 个 locale 的 i18n key。

## Capabilities

### New Capabilities

- `grok-engine-runtime`: Grok CLI 作为第四引擎的消息发送 / 流式渲染 / 中断 / session 续聊。
- `grok-session-history`: Grok 历史会话的列表 / 加载 / 删除，接入统一 session catalog。
- `grok-cli-lifecycle`: Grok CLI 的安装 / 升级 / doctor 诊断。
- `grok-vendor-providers`: Grok provider CRUD 与 `config.toml` 物化切换。

### Modified Capabilities

- `engine-capability-matrix`: matrix fixture 与 Rust 推导增加 grok 条目（streaming text / reasoning / tool.use / session continuation+resume = supported；streaming.tool-output / MCP / reasoning effort / collaboration / image input / mid-turn input / rpc = unsupported；session fork/switch/tree = unknown）。

## Impact

- Affected code: `src-tauri/src/engine/**`、`src-tauri/src/codex/{installer,doctor,mod}.rs`、`src-tauri/src/vendors/**`、`src-tauri/src/session_management*.rs`、`src-tauri/src/bin/cc_gui_daemon/**`（影子副本）、`src/features/{settings,vendors,threads,engine,composer,models}/**`、`src/services/tauri/**`、`src/i18n/locales/*`、`scripts/check-engine-*.mjs`、`scripts/check-model-provider-catalog.mjs`。
- APIs: 新增 Tauri 命令 `list_grok_sessions` / `load_grok_session` / `delete_grok_session` / `grok_doctor` / `vendor_*_grok_*`；`cli_install_plan` / `cli_install_run` 的 `engine` 接受 `"grok"`。
- Data: 只读写 `~/.grok/**`（GROK_HOME 可覆盖）与 ccgui `config.json` 的新 `grok` key；旧 key 不受影响；config.toml 写前自动备份 `.bak`。
- Compatibility: 未安装 Grok CLI 时引擎显示 not-installed 诊断，不影响其他引擎。

## 目标与边界

- 目标：Grok 引擎在对话、历史、设置、vendor 四个面达到与 Kimi 相同的可用完备度。
- 边界：Grok 引擎常驻启用（不加 enable 开关）；session id 由 backend 预生成 UUID（`-s` 仅用于新会话，`-r` 续跑）；`-p` headless 强制 `--always-approve`，无审批交互（streaming-json 协议不暴露审批与工具事件）。

## 非目标

- 不实现 Grok 的 shared session（仅 Claude/Codex 支持）。
- 不实现 uninstall（保护 `~/.grok` 登录态与会话）；不做 MCP 管理面、slash commands（协议/范围外，后续单独补）。
- image input 与 reasoning effort UI **不在本 change 范围**；后续分别由 `grok-cli-image-input-capability-gap`、`grok-cli-reasoning-effort` 收口（勿再把本 proposal 当「至今未做」的事实源）。
- 不解析 `chat_history.jsonl` 中的 system / prompt_context / events.jsonl；history 只还原 user / assistant / reasoning / tool 主线。
- 不接入 grok ACP（`grok agent stdio`）模式；本期只用 one-shot headless。

## 风险

- `config.toml` 物化若与用户手改冲突：以 `ccgui/` 命名空间隔离 + `.bak` 备份 + 原子写（tmp + rename）兜底。
- streaming-json 事件类型随 grok 版本演进（`max_turns_reached` / `auto_compact_*` 等）：parser 对未知事件一律 skip，最坏情况是历史/流式少展示内容，不会报错。
- grok 将会话目录按 URL-encoded cwd 组织，macOS 存在 `/tmp`→`/private/tmp` 类 symlink：history 匹配必须双侧 canonicalize。
- `--session-id` 对新会话冲突即报错：UUID 由 backend 生成，碰撞概率忽略；若 CLI 行为变化导致 `-s` 语义漂移，冒烟环节会发现。
