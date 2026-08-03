## ADDED Requirements

### Requirement: Durable Shared Commit MUST Install an Exact-Turn Frontend Terminal Barrier

Shared V2 send 在 exact attempt 的 durable `conversation.turnCommitted` 返回后，MUST 使用
该 dispatch 的 `runtimeTurnId` 安装 frontend realtime terminal barrier，再释放 Composer
processing state。Frontend transient `turn/completed` MUST NOT 成为安装该 barrier 的必要条件。

#### Scenario: durable commit ends Composer without frontend terminal event

- **WHEN** Shared Runtime 已为 exact attempt durable commit `conversation.turnCommitted`
- **AND** frontend 没有收到对应的 `turn/completed`
- **THEN** Shared Composer MUST 回到 idle
- **AND** Stop control 与 active Turn MUST 被清除

#### Scenario: late realtime projection cannot revive committed turn

- **WHEN** exact Shared Turn 已经 durable committed
- **AND** 该 Turn 的 delayed `turn/started`、assistant delta、reasoning delta 或 item update
  在 commit 后到达
- **THEN** event MAY 补齐结算前已排队的展示内容
- **AND** event MUST NOT 把 processing 或 active Turn 重新设为运行中

#### Scenario: terminal barrier uses runtime identity

- **WHEN** Shared committed response 同时包含 attempt identity、logical identity 与
  `runtimeTurnId`
- **THEN** realtime terminal barrier MUST 使用 exact `runtimeTurnId`
- **AND** system MUST NOT 使用 `attemptId`、`logicalTurnId` 或当前 active target 冒充
  Runtime Turn identity

#### Scenario: next shared turn remains startable

- **WHEN** 上一个 Shared Turn 已通过 durable terminal barrier 结算
- **AND** 用户在同一 Shared Session 提交下一 Turn
- **THEN** 新 `runtimeTurnId` MUST 建立新的 processing lifecycle
- **AND** 上一 Turn 的 terminal barrier MUST NOT 丢弃新 Turn 的 realtime event

#### Scenario: provider choice does not change terminal behavior

- **WHEN** Claude Code Shared target 使用 Kimi、MiniMax 或其他可执行 Provider
- **THEN** durable terminal barrier MUST 使用同一 engine-neutral path
- **AND** frontend MUST NOT 通过 Provider 或 Model 名称决定是否结束 Composer
