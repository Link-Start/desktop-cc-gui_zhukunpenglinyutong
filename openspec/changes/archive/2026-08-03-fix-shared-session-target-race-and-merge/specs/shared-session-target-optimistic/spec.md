# shared-session-target-optimistic Specification

## ADDED Requirements

### Requirement: Shared Target Change MUST Update UI Optimistically

Shared Session 的 target 切换 MUST 先乐观更新 UI（`hydrateSharedTargetState`），再异步持久化（`persistSharedSessionSelectedTarget`）。持久化失败时 MUST 回滚到变更前值并通过 toast 通知用户。

#### Scenario: successful target change updates UI immediately then persists

- **WHEN** 用户在 Shared Session 中通过 Atomic 选择器切换 target
- **THEN** 系统 MUST 立即调用 `hydrateSharedTargetState` 更新 `selectedNextTarget`
- **AND** 随后调用 `persistSharedSessionSelectedTarget` 持久化
- **AND** 持久化成功时 `selectedNextTarget` 保持新值（或后端权威 target）不变

#### Scenario: persist failure rolls back optimistic update

- **WHEN** 乐观更新已写入 store 但 `persistSharedSessionSelectedTarget` 返回失败
- **THEN** 系统 MUST 将 `selectedNextTarget` 回滚到 persist 调用前的值
- **AND** MUST 通过 toast 告知用户选择未生效

### Requirement: History Reload MUST NOT Overwrite In-Flight Or Complete Target

当 Shared Session 有正在进行的 target 写入，或 store 已有完整 target 时，`sharedHistoryLoader` MUST NOT 用 stale / 不完整 persisted 覆盖。

#### Scenario: history reload during in-flight persist does not clear target

- **WHEN** 用户刚切换 target（乐观 hydrate 已递增 generation），同时 `sharedHistoryLoader` 被触发重载
- **THEN** loader MUST 检测到 generation 已前进
- **AND** MUST 跳过用旧 persisted 覆盖 store

#### Scenario: incomplete persisted target does not degrade complete store

- **WHEN** `sharedHistoryLoader` 返回 null 或不完整 `selectedTarget`
- **AND** store 中已有完整 `ResolvedExecutionTarget`
- **THEN** loader MUST NOT 将 store 覆盖为 null 或不完整值

#### Scenario: first load with empty store may hydrate null

- **WHEN** store 中无完整 target
- **AND** persisted 亦不完整或为 null
- **THEN** loader MAY hydrate null（正常初始化路径）
