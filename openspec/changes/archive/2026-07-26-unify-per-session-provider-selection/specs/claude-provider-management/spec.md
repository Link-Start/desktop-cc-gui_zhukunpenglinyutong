# claude-provider-management Delta Spec

## ADDED Requirements

### Requirement: Claude Conversation Creation MUST Select A Provider Profile

系统 MUST 将 Claude 供应商选择建模为新建会话的启动决策，而非仅为全局 active provider 切换。

#### Scenario: local settings.json is the intentional default profile

- **WHEN** 用户打开新建 Claude 会话入口的供应商子菜单
- **THEN** 选择器 MUST 包含代表本地 `~/.claude/settings.json` 的默认项（`__local_settings_json__`）
- **AND** 选择该项 MUST 保持现有 Claude 启动行为不变
- **AND** UI MUST 明确该项跟随 disk/global settings，不承诺与全局切换隔离

#### Scenario: provider selection is persisted with the created thread

- **WHEN** 用户以选定的 managed provider 创建 Claude 会话
- **THEN** 该 thread 的 state MUST 记录 provider profile id、source 与用户可见名称
- **AND** 该 thread 后续所有发送 MUST 使用持久化绑定而非当前菜单选择

#### Scenario: menu selection only affects the next new conversation

- **WHEN** 用户在新建会话菜单的供应商子菜单中勾选某个 provider
- **THEN** 系统 MUST 仅记忆该选择（localStorage）供下一次新建会话使用
- **AND** MUST NOT 改变任何已有会话的绑定
- **AND** MUST NOT 触发全局 `~/.claude/settings.json` 写入

### Requirement: Claude Provider MUST Take Effect Via Per-Turn Environment Injection

绑定 managed provider 的 Claude 会话 MUST 通过 spawn 时的环境变量注入使供应商生效，而非写入全局 settings.json。

#### Scenario: managed provider env is injected per turn

- **WHEN** 绑定 managed provider 的 Claude thread 发送消息
- **THEN** 后端 MUST 从 `~/.ccgui/config.json` 的 `claude.providers[id].settingsConfig.env` 解析键值对
- **AND** MUST 在该 turn 的 `claude` 进程中通过 `cmd.env` 注入全部键值（含 `ANTHROPIC_BASE_URL` / `ANTHROPIC_AUTH_TOKEN` / `ANTHROPIC_API_KEY` 等，不过滤键名）

#### Scenario: env injection overrides global settings.json

- **WHEN** 全局 `~/.claude/settings.json` 的 `env` 块与绑定 provider 的 `settingsConfig.env` 存在相同键
- **THEN** per-turn 注入的环境变量 MUST 生效（进程 env 优先级高于 settings.json）

#### Scenario: missing provider fails the send with a clear error

- **WHEN** 绑定指向的 provider id 在 `~/.ccgui/config.json` 中已不存在
- **THEN** 该次发送 MUST 以包含 provider 标识的错误失败
- **AND** MUST NOT 静默回退到其他供应商

## MODIFIED Requirements

### Requirement: Claude provider order SHALL be user-controlled and activation-safe

系统 SHALL 允许用户持久化重排 managed Claude providers 而不改变 active provider。全局 active provider 的语义 MUST 被理解为「无绑定会话的默认供应商」；已建立 per-session 绑定的会话不受全局切换影响。

#### Scenario: local provider remains pinned
- **WHEN** the Claude provider list is rendered
- **THEN** the `Local settings.json` provider SHALL appear before managed providers
- **AND** it SHALL NOT be included in the draggable provider list

#### Scenario: active provider remains pinned outside draggable list
- **WHEN** a managed Claude provider is active
- **THEN** the active provider SHALL render above non-active managed providers
- **AND** the active provider SHALL NOT expose a drag handle
- **AND** dragging non-active providers SHALL NOT change which provider is active

#### Scenario: non-active provider reorder is persisted
- **WHEN** the user drags a non-active managed Claude provider to a new position
- **THEN** the frontend SHALL send the full managed provider id order to the backend
- **AND** the backend SHALL persist deterministic `sortOrder` values for existing managed providers
- **AND** missing or legacy `sortOrder` values SHALL fall back to `createdAt` order for migration compatibility

#### Scenario: previous active provider returns to stored position
- **WHEN** the user switches active provider after providers have been reordered
- **THEN** the newly active provider SHALL be visually pinned
- **AND** the previously active provider SHALL return to its persisted order among non-active providers

#### Scenario: reorder failure rolls back from durable state
- **WHEN** persisting a Claude provider reorder fails
- **THEN** the frontend SHALL reload providers from the backend
- **AND** the visible order SHALL return to the durable backend state

#### Scenario: global switch leaves managed-bound sessions untouched
- **WHEN** 用户在设置页切换全局 active provider（触发 `~/.claude/settings.json` 写入）
- **THEN** 已有 managed per-session 绑定的 Claude 会话的后续发送 MUST 继续按绑定注入 env
- **AND** 无绑定或 `__local_settings_json__` 会话 MUST 跟随新的全局配置
