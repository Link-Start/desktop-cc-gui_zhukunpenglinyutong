# engine-per-session-provider-binding Specification

## Purpose

定义引擎无关的 per-session 供应商绑定契约：新建会话时可选定供应商，绑定随 thread 持久化，该 thread 后续所有 turn 按绑定路由，同一 workspace 下不同绑定的会话可并行使用不同供应商。

## Requirements

### Requirement: Per-Session Provider Binding MUST Be Recorded And Resolvable

系统 MUST 将 managed provider 绑定建模为会话级 launch configuration（而非全局切换），并在发送消息时按固定优先级解析生效供应商。

#### Scenario: binding recorded from send parameter

- **WHEN** `engine_send_message` 携带 `providerProfileId` 且目标引擎为 Claude Code 或 Kimi CLI
- **THEN** 后端 MUST 将该绑定（engine、profile id、source、显示名、availability）幂等写入 workspace catalog metadata 的统一 engine provider binding map
- **AND** metadata key MUST 使用显式 engine + owner workspace + canonical/logical session identity，不得从无前缀 native id 猜引擎
- **AND** 当参数值与已持久化绑定一致时 MUST 跳过写入

#### Scenario: resolution priority

- **WHEN** 后端为某个 thread 的一次发送解析供应商
- **THEN** 解析优先级 MUST 为：send 参数携带的 managed `providerProfileId` > catalog metadata 中该 thread 的持久化 managed binding > 无绑定/default
- **AND** 无绑定时 MUST 保持变更前的行为（Claude 走全局 `~/.claude/settings.json`，Kimi 走全局 `~/.kimi-code/config.toml` / 引擎默认 home）

#### Scenario: binding survives thread id rename

- **WHEN** 一个 `claude-pending-*` / `kimi-pending-*` 前端乐观创建的 thread 在首个 turn 后被重命名为真实 session id
- **THEN** 后续发送 MUST 仍能解析到正确绑定（前端每次发送从 thread state 携带 `providerProfileId`）
- **AND** 应用重启后从历史恢复的 thread MUST 能通过持久化绑定兜底解析

#### Scenario: local profile means intentional default behavior

- **WHEN** 绑定的 profile 为本地配置项（Claude 的 `__local_settings_json__`、Kimi 的 `__local_config_toml__`）
- **THEN** 后端 MUST NOT 注入任何 per-session 覆盖
- **AND** 行为 MUST 与无绑定一致并继续跟随 disk/global config
- **AND** UI MUST NOT 把 local/default profile 描述成隔离的 managed binding

### Requirement: Parallel Sessions With Different Providers MUST Be Isolated

同一 workspace 下，绑定不同供应商的会话 MUST 并行运行且互不影响。

#### Scenario: two Claude threads with different providers

- **WHEN** 同一 workspace 下同时存在绑定 managed provider A 的 Claude 会话与绑定 managed provider B（或本地配置）的 Claude 会话
- **THEN** 两个会话各自的 turn 进程 MUST 仅注入各自绑定对应的供应商配置
- **AND** 任一会话的发送 MUST NOT 修改全局 `~/.claude/settings.json`

#### Scenario: two Kimi threads with different providers

- **WHEN** 同一 workspace 下同时存在绑定不同 managed provider 的 Kimi 会话
- **THEN** 每个会话的 `kimi` 进程 MUST 以其绑定 provider 物化的独立 `KIMI_CODE_HOME` 启动
- **AND** 任一会话的发送 MUST NOT 修改全局 `~/.kimi-code/config.toml`

#### Scenario: Kimi workspace control reaches every provider runtime

- **WHEN** 同一 workspace 下存在多个 provider-scoped Kimi runtime，用户执行 workspace interrupt、turn interrupt、remove 或 shutdown
- **THEN** manager MUST 定位并控制该 workspace 下的全部 matching runtime
- **AND** provider-scoped map key MUST NOT 使旧 workspace-only control path 漏掉 child process owner

#### Scenario: global switch does not reroute bound threads

- **WHEN** 用户在设置页切换全局供应商（`vendor_switch_claude_provider` / `vendor_switch_kimi_provider`）
- **THEN** managed-bound 会话的后续发送 MUST 继续使用其绑定供应商
- **AND** 无绑定或 local/default 会话 MUST 跟随新的全局默认

### Requirement: Child Threads MUST Inherit Parent Binding

通过 fork（Claude）或 continue（Kimi）产生的子会话 MUST 继承父会话的供应商绑定。

#### Scenario: fork inherits binding

- **WHEN** 用户 fork 一个绑定了供应商的 Claude thread
- **THEN** 新 child thread 的 thread state MUST 拷贝父 thread 的 `providerProfileId` / `providerProfileSource` / `providerProfileName`
- **AND** child thread 的发送 MUST 按继承的绑定路由

#### Scenario: sidebar shows provider label

- **WHEN** 侧边栏渲染绑定了 managed provider 的 thread
- **THEN** 该 thread MUST 显示其绑定的供应商名称标签（与 Codex 现有标签行为一致）

### Requirement: Canonical Provider Binding MUST Be Persisted At Identity Promotion

当 runtime 首次暴露 canonical session identity 时，系统 MUST 将该 turn 已解析的 managed provider binding 持久化到 canonical session key，而不能只依赖 pending alias、parent id 或下一次 send。

#### Scenario: Kimi first turn promotes pending identity

- **WHEN** managed-bound Kimi turn 从 `kimi-pending-*` 收到真实 `SessionStarted.session_id`
- **THEN** backend MUST 幂等写入该 canonical Kimi session 的 provider binding
- **AND** 首轮结束后立即重启仍 MUST 从 catalog 恢复 provider metadata

#### Scenario: Claude fork receives child identity

- **WHEN** managed-bound Claude fork 的 child canonical session id 首次出现
- **THEN** backend MUST 将继承的 provider binding 写入 child canonical key
- **AND** MUST NOT 只更新 parent binding

#### Scenario: canonical binding persistence fails

- **WHEN** canonical binding metadata 写入失败
- **THEN** backend MUST 输出包含 engine、workspace 与 session identity 的可诊断错误
- **AND** MUST NOT 把失败报告成持久化成功

### Requirement: Provider Catalog Failure MUST Not Silently Change Provider

新会话入口读取 provider catalog 失败或 remembered managed provider 不可解析时，系统 MUST fail closed 或要求用户显式选择，不得静默改用 local/default provider。

#### Scenario: remembered managed provider is absent from loaded catalog

- **WHEN** localStorage 记住 managed provider A，但当前 catalog 未返回 A
- **THEN** 新会话菜单 MUST 保留 A 的不可用选择语义或阻止创建
- **AND** MUST NOT 自动选中 local/default 并继续创建

#### Scenario: provider catalog request fails

- **WHEN** Claude、Codex 或 Kimi provider catalog 加载失败
- **THEN** UI MUST 显示可诊断错误
- **AND** 用户显式选择 local/default 前 MUST NOT 把 remembered managed selection 解释为 local/default

### Requirement: Claude Runtime Ownership MUST Be Provider-Scoped

Claude runtime manager MUST use workspace owner and provider profile identity as the runtime ownership boundary while preserving shared Claude history storage.

#### Scenario: two managed providers run in parallel

- **WHEN** 同一 workspace 下 provider A 与 provider B 绑定的 Claude threads 并行发送
- **THEN** 系统 MUST 使用两个不同的 Claude runtime owners
- **AND** 每个 child process MUST 只接收自己 provider 的 environment
- **AND** session id、active turn、pending user input、approval state 与 child ownership MUST NOT 在两个 runtime 间共享

#### Scenario: local and managed provider run in parallel

- **WHEN** local/default Claude thread 与 managed provider thread 并行发送
- **THEN** local runtime MUST NOT 接收 managed provider env
- **AND** managed runtime MUST NOT 写入或切换 `~/.claude/settings.json`
- **AND** 两个 runtime MUST 能独立 interrupt 和完成

#### Scenario: secondary spawn inherits provider launch context

- **WHEN** managed Claude turn 触发 legacy flag retry、auto-compact、AskUserQuestion resume、approval resume 或其他 same-turn child restart
- **THEN** 每个 secondary child MUST 继承原 turn 的 provider launch context
- **AND** MUST NOT fallback 到 local/default environment

#### Scenario: workspace cleanup covers all Claude providers

- **WHEN** 用户 interrupt workspace、remove workspace、切换 Claude binary 或关闭 host
- **THEN** manager MUST 找到该 workspace 的全部 provider-scoped Claude runtimes
- **AND** cleanup failure MUST 保留未确认终止的 child owner并返回或记录可诊断错误

#### Scenario: turn interrupt targets one runtime

- **WHEN** 用户按 `turnId` 中断某个 Claude turn
- **THEN** manager MUST 只中断持有该 turn 的 provider runtime
- **AND** 其他 provider runtime 的并行 turn MUST 继续运行

#### Scenario: missing provider fails closed

- **WHEN** persisted thread binding 指向已删除或非法的 managed Claude provider
- **THEN** send MUST 返回包含 provider id 的 contextual error
- **AND** manager MUST NOT create or reuse local runtime as fallback

#### Scenario: legacy provider env scalar values are normalized

- **WHEN** imported 或 legacy managed Claude provider 的 `settingsConfig.env` 包含 JSON string、number 或 boolean scalar
- **THEN** shared provider resolver MUST 将 number 与 boolean 按 JSON scalar 语义规范化为 process env string
- **AND** provider-scoped model catalog 与 primary/secondary child launch MUST 使用同一份 normalized environment
- **AND** `null`、object 或 array value MUST 返回包含 provider id 与 env key 的 contextual error
- **AND** invalid composite value MUST NOT fallback 到 local/default runtime 或 global model catalog

#### Scenario: managed provider overrides user settings without global mutation

- **GIVEN** `~/.claude/settings.json` 包含另一供应商的 `ANTHROPIC_*` environment
- **WHEN** 绑定 managed provider 的 Claude turn 启动 primary child 或 same-turn resume child
- **THEN** child MUST 同时接收 normalized provider process env 与 command-line `--settings` override
- **AND** command-line settings MUST 包含当前 provider 的 auth、base URL 与 model environment
- **AND** Local settings 中的同名 environment MUST NOT 覆盖当前 provider
- **AND** secret MUST NOT 直接出现在 process arguments、日志或 diagnostic payload
- **AND** private settings artifact MUST 在 turn attempt 结束后清理
- **AND** local/default turn MUST NOT 创建或传入 managed settings override
