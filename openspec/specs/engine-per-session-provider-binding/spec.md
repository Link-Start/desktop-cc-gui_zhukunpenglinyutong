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
