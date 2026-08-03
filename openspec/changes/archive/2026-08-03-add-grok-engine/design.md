# Grok 引擎接入设计

## 问题

Grok CLI 需要以第四引擎身份接入 ccgui，覆盖对话 / 历史 / 设置 / vendor 四个面。
Grok 的 headless 协议与 Kimi 同构（one-shot spawn + NDJSON stdout），但有三点关键差异
需要在设计中显式处理：

1. streaming-json 只暴露 `text` / `thought` / `end` / `error` 四类事件，**无工具调用事件**，
   也无 session meta 行。
2. CLI 原生支持 `-s <uuid>` 由调用方指定**新**会话 UUID、`-r <id>` 续跑，
   会话身份可以在 turn 启动前由 backend 确定。
3. 会话存储按 `$GROK_HOME/sessions/<url-encoded-cwd>/<uuid>/` 组织，
   元数据在 `summary.json`、消息在 `chat_history.jsonl`，与 kimi 的 index+wire 布局不同。

## 决策

1. **命令构造**：`grok --output-format streaming-json --always-approve [-m <model>]
   (-s <new-uuid> | -r <id>) -p <text>`，进程 cwd = workspace；env 注入
   `GROK_HOME=<provider home>`（仅 managed provider）与 `GROK_DISABLE_AUTOUPDATER=1`
   （0.2.111 无 `--no-auto-update` flag）。`--always-approve` 是 headless 可执行工具的
   前提（协议无审批面），与 kimi `-p` 固定 auto 权限策略同级。
   **`-m` 必须传 `[model.<alias>]` 的 section 别名**（或内置模型名）：grok 的 `-m`
   解析 config section alias，不解析 section 内部 `model` 字段；传 API 模型名会选中
   内置模型、绕过自定义 `base_url`/`api_key`（实测 401 打到 cli-chat-proxy.grok.com）。
   因此模型目录的 `ModelInfo.model` 必须等于 alias（managed provider 为物化别名
   `ccgui/<model>`），与 kimi 的 `--model <alias>` 语义一致。
2. **会话身份**：新会话由 backend 生成 UUID v4 并以 `-s` 开会话，`SessionStarted`
   立即携带 canonical id；续聊 `-r`；`end.sessionId` 仅作为一致性校验。
   前端 pending 行（`grok-pending-*`）在首个事件到达时即获得 canonical id，
   不引入 kimi 的 pending→canonical promotion 状态机。
3. **事件映射**：`text`→`TextDelta`；`thought`→`ReasoningDelta`；
   `end`→`TurnCompleted`（result 带 text + usage）；`error`→`TurnError`；
   `max_turns_reached` / `auto_compact_*` / 未知类型 → skip。无 ToolStarted/Completed
   （协议不暴露），UI 不展示工具卡片，与协议能力一致。
4. **历史**：list 遍历 `sessions/*/`、URL-decode 目录名得到 cwd、双侧 canonicalize
   后与 workspace 匹配，读 `summary.json`；load 解析 `chat_history.jsonl`，
   user 行剥 `<user_query>` 包裹并跳过 synthetic reminder，assistant 行还原 text 与
   tool_calls，reasoning 行取 summary，tool_result 行还原 tool 输出；delete 删整个
   session 目录。parser 对未知行类型 skip。
5. **Vendor 物化**：provider 存 ccgui `config.json` `grok` section；switch 时在
   `$GROK_HOME/config.toml` upsert `[model."ccgui/<model-name>"]`
   （`model` / `base_url` / `name` / `api_key` / `api_backend` / `context_window`）
   并设 `[models] default = "ccgui/<model-name>"`；`__local_config_toml__` 伪 provider
   不动 config.toml；managed provider 会话用独立 `GROK_HOME`
   （`app_paths::grok_provider_homes_dir()/<id>/`），runtime key =
   `grok::{workspace}::{profile}`。`api_backend` 三选一
   （`chat_completions` / `responses` / `messages`），preset 默认 `responses`。
6. **能力矩阵**：如实标注 `streaming.tool-output = unsupported`（协议限制），
   `tool.use = supported`（CLI 实际执行工具，只是不回放事件）。

## 备选方案

- 用 ACP（`grok agent stdio`）做 persistent session：拒绝，本期范围是 one-shot
  headless（与 kimi 对齐），ACP 接入是独立 change。
- 像 kimi 一样从流里等 CLI 暴露 session id：拒绝，grok 只在 `end` 事件给 sessionId，
  等到末尾才确定 identity 会重现 kimi 的 promotion 复杂度；`-s` 预生成是协议原生能力。
- 物化 provider 时直接改写 `[models] default` 指向用户已有条目：拒绝，
  `ccgui/` 命名空间保证用户手改条目不被覆盖。

## 验证

- Rust 单测覆盖 stream parser 四类事件 + unknown skip、history parser 行型还原、
  provider 物化 toml 渲染、cwd 编解码匹配。
- `cargo test` 全量 + daemon target `cargo check`、typecheck、lint、受影响 vitest、
  contract scripts（capability-matrix / adapter-registry / model-catalog / branding /
  app-shell-runtime-contract）与 strict OpenSpec validation 全部通过。
- 冒烟：真实 `grok -p --output-format streaming-json --always-approve` 输出与 parser
  逐字比对；GUI 内发消息 / 续聊 / 历史加载 / vendor switch 后核对 `~/.grok/config.toml`。
