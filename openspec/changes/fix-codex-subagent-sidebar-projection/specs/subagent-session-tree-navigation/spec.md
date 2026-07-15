## MODIFIED Requirements

### Requirement: Subagent Sessions MUST Be Represented As First-Class Child Sessions

系统 MUST 将 Claude Code 与 Codex collaboration 启动的子 agent 表达为一等 child session，并通过稳定 relationship 字段关联到 parent session，而不是仅依赖父会话 transcript 或继承的标题文本猜测关系。

#### Scenario: Codex rollout metadata preserves child relationship

- **WHEN** Codex child rollout 的 `session_meta.payload.source.subagent.thread_spawn` 包含 `parent_thread_id`
- **THEN** local source fact MUST 保留 child 自己的 canonical UUID
- **AND** catalog / local-thread projection MUST 输出对应 `parentSessionId`
- **AND** Sidebar MUST 将 child row 放在 parent row 下，而不是显示为同名顶层 session

#### Scenario: Codex child title prefers agent identity

- **WHEN** child rollout 同时包含 inherited parent prompt 与 `agent_nickname` 或 `agent_path`
- **THEN** child display title MUST 优先使用 agent identity
- **AND** MUST NOT 因 inherited parent prompt 让多个 distinct child UUID 显示为相同 parent title

#### Scenario: repeated parent metadata does not overwrite child identity

- **GIVEN** child rollout 首条 metadata 已建立 child UUID 与 parent UUID
- **WHEN** 文件后续包含 copied parent `session_meta`
- **THEN** parser MUST 保持首次有效 child identity / relationship
- **AND** MUST NOT 将 child session 重写为 parent session

#### Scenario: duplicate rollout for one child converges by canonical identity

- **WHEN** 两个 physical rollout files 声明相同 child canonical UUID
- **THEN** scanner MUST 在 usage aggregation 与 bounded truncation 前收敛为一个 child session source fact
- **AND** usage/cost evidence MUST NOT 因 physical duplicate 求和
- **AND** catalog MUST 收敛为一个 child session entry 并只计一个 child
- **AND** MUST NOT 按 title 合并不同 child UUID

#### Scenario: visible rollout aliases preserve the parent tree

- **GIVEN** app-server visible parent/child row id 使用 rollout filename alias
- **AND** local source facts 提供 canonical parent/child UUID 与 alias
- **WHEN** runtime local/live entries merge
- **THEN** visible rows MUST 保留 canonical `canonicalSessionId`
- **AND** child `parentSessionId` MUST 解析为当前 visible parent row id
- **AND** Sidebar MUST NOT 因 canonical/visible id 不相等把 child 提升为 root
