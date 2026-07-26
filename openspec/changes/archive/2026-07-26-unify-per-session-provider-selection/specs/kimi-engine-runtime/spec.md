# kimi-engine-runtime Delta Spec

## ADDED Requirements

### Requirement: Kimi Conversation Creation MUST Select A Provider Profile

系统 MUST 将 Kimi 供应商选择建模为新建会话的启动决策，而非仅为全局 provider 切换。

#### Scenario: local config.toml is the intentional default profile

- **WHEN** 用户打开新建 Kimi 会话入口的供应商子菜单
- **THEN** 选择器 MUST 包含代表本地 `~/.kimi-code/config.toml` 的默认项（`__local_config_toml__`）
- **AND** 选择该项 MUST 保持现有 Kimi 启动行为不变
- **AND** UI MUST 明确该项跟随 disk/global config，不承诺与全局切换隔离

#### Scenario: provider selection is persisted with the created thread

- **WHEN** 用户以选定的 managed provider 创建 Kimi 会话
- **THEN** 该 thread 的 state MUST 记录 provider profile id、source 与用户可见名称
- **AND** 该 thread 后续所有发送 MUST 使用持久化绑定而非当前菜单选择

#### Scenario: menu selection only affects the next new conversation

- **WHEN** 用户在新建会话菜单的供应商子菜单中勾选某个 provider
- **THEN** 系统 MUST 仅记忆该选择（localStorage）供下一次新建会话使用
- **AND** MUST NOT 改变任何已有会话的绑定
- **AND** MUST NOT 触发全局 `~/.kimi-code/config.toml` 写入

### Requirement: Kimi Provider MUST Take Effect Via Per-Provider Home Materialization

绑定 managed provider 的 Kimi 会话 MUST 通过注入 per-provider 物化的 `KIMI_CODE_HOME` 使供应商生效，而非改写全局 config.toml。

#### Scenario: managed provider home is materialized

- **WHEN** 绑定 managed provider 的 Kimi thread 发送消息
- **THEN** 后端 MUST 将该 provider 的配置物化为 `~/.ccgui/kimi-provider-homes/<provider-id>/config.toml`（含 `providers` / `models` / `default_model`，结构与全局物化一致）
- **AND** 物化文件 MUST 使用 owner-only 权限（0600）
- **AND** provider id MUST 经过路径安全校验（拒绝目录穿越与保留名）

#### Scenario: per-provider home is injected per turn

- **WHEN** 绑定 managed provider 的 Kimi thread 的某个 turn 启动 `kimi` 进程
- **THEN** 后端 MUST 注入 `KIMI_CODE_HOME` 指向该 provider 的物化 home
- **AND** MUST NOT 修改全局 `~/.kimi-code/config.toml`

#### Scenario: different providers run in parallel

- **WHEN** 同一 workspace 下存在绑定不同 managed provider 的多个 Kimi 会话
- **THEN** 后端 MUST 按 `workspace_id + provider_profile_id` 维度管理运行时 session
- **AND** 各会话的 `kimi` 进程 MUST 使用各自 provider 的 home

#### Scenario: provider-scoped runtime remains controllable

- **WHEN** provider-scoped Kimi session 正在运行且用户中断 turn、关闭 workspace 或应用退出
- **THEN** runtime manager MUST 通过 workspace + provider-aware lookup 找到并清理真实 process owner
- **AND** cleanup failure MUST 显式传播并保留 owner 供诊断/重试

#### Scenario: missing provider fails the send with a clear error

- **WHEN** 绑定指向的 provider id 在 `~/.ccgui/config.json` 中已不存在
- **THEN** 该次发送 MUST 以包含 provider 标识的错误失败
- **AND** MUST NOT 静默回退到其他供应商

#### Scenario: global switch leaves managed-bound sessions untouched

- **WHEN** 用户在设置页切换全局 Kimi provider（触发 `~/.kimi-code/config.toml` 写入）
- **THEN** 已有 managed per-session 绑定的 Kimi 会话的后续发送 MUST 继续使用其物化 home
- **AND** 无绑定或 `__local_config_toml__` 会话 MUST 跟随新的全局配置
