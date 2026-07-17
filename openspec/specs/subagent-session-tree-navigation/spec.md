# subagent-session-tree-navigation Specification

## Purpose

Defines the subagent-session-tree-navigation behavior contract, covering Subagent Sessions MUST Be Represented As First-Class Child Sessions.
## Requirements
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

### Requirement: Session Sidebar MUST Render Parent-Child Session Tree

左侧 session 列表 MUST 能将 child agent sessions 展示在其 parent session 下，形成可展开的树形结构，并保留当前 workspace projection 的 scope 与 archive 规则。

#### Scenario: parent row expands to child agent sessions
- **WHEN** 当前 workspace projection 包含一个 parent session 及其 child agent sessions
- **THEN** sidebar MUST 在 parent row 下展示 child rows
- **AND** child rows MUST 显示 agent 名称或角色、运行状态与最近活动时间

#### Scenario: child rows do not widen workspace membership
- **WHEN** 某 child session 不属于当前 workspace projection scope
- **THEN** sidebar MUST NOT 因 parent relationship 强行展示该 child session
- **AND** parent-child tree MUST 继续遵守共享 workspace session scope resolver

#### Scenario: selecting child session is distinct from selecting parent session
- **WHEN** 用户点击 child session row
- **THEN** 系统 MUST 激活 child session 对话上下文
- **AND** MUST NOT 将该操作解释为打开 parent session

### Requirement: Conversation Curtain MUST Show Live Subagent Session Cards

实时幕布 MUST 在 parent session 执行期间展示子 agent session cards，让用户在运行中看到子 agent 的状态与最近活动，而不是等子 agent 完成后才回灌。

#### Scenario: live curtain shows subagent cards during execution
- **WHEN** parent Claude session 有 running child agents
- **THEN** conversation curtain MUST 展示每个 running child agent 的 card
- **AND** card MUST 至少包含 agent 名称或角色、状态、最近活动摘要和更新时间

#### Scenario: subagent card updates without duplicating transcript rows
- **WHEN** 同一 child agent 持续产生 progress updates
- **THEN** curtain MUST 更新同一张 subagent card
- **AND** MUST NOT 为每次 progress 追加重复 agent session card

#### Scenario: completed child remains as structured reference
- **WHEN** child agent 完成
- **THEN** parent curtain MAY 将 card 状态更新为 completed 并展示摘要
- **AND** MUST NOT 将 child agent 的完整对话内容作为 parent session 的普通 assistant 正文重复渲染

### Requirement: Subagent Cards MUST Support Direct Navigation To Child Conversation

子 agent session card MUST 提供稳定 jump target，允许用户从 parent curtain 直接进入 child conversation，并且不影响 parent session 或 sibling agents 的后台执行。

#### Scenario: clicking running subagent card opens child session
- **WHEN** 用户点击 parent curtain 中的 running subagent card
- **THEN** 系统 MUST 激活对应 workspace/thread/session 的 child conversation
- **AND** parent session 与其他 child agents MUST 继续按原状态运行

#### Scenario: missing jump target is rendered as disabled with reason
- **WHEN** subagent relationship 缺少可用 `jumpTarget`
- **THEN** card MUST 显示不可点击状态
- **AND** UI MUST 提供详情暂不可用或 session 尚未建立的解释

#### Scenario: returning to parent preserves context
- **WHEN** 用户从 child session 返回 parent session
- **THEN** parent session MUST 保留原对话上下文与运行状态
- **AND** child navigation MUST NOT 触发 parent transcript reload 的重复回灌

### Requirement: Subagent Relationship Projection MUST Be Deterministic And Deduplicated

系统 MUST 对子 agent relationship 使用确定性排序与去重，避免并发更新时 sidebar 或 curtain 出现跳项、重复子 agent 或错绑 parent。

#### Scenario: child agents sort by spawn order then freshness
- **WHEN** parent session 同时存在多个 child agents
- **THEN** UI SHOULD 优先按 spawn order 展示
- **AND** spawn order 不可用时 MAY 按 `updatedAt` 与稳定 id 排序

#### Scenario: duplicate source events converge to one child relationship
- **WHEN** spawn、runtime progress 与 history hydrate 同时提供同一 child agent 信息
- **THEN** projection MUST 基于 stable child identity 或 `spawnedByToolCallId` 收敛为一条 child relationship
- **AND** sidebar 与 curtain MUST NOT 出现重复 child row/card

#### Scenario: stale child completion does not overwrite newer running evidence
- **WHEN** out-of-order history refresh 提供较旧的 child completion 或 summary
- **AND** runtime source 已有更新的 running/progress evidence
- **THEN** projection MUST 保留更新鲜的 relationship 状态
- **AND** MUST NOT 因 stale source 让 card 状态倒退

### Requirement: Parent Turn Settlement MUST Not Be Blocked By Residual Child-Agent Status After Final Assistant Completion

系统 MUST 在 Codex collaboration child-agent 场景中区分“主 turn 是否可结算”和“child-agent tool row 是否仍有残留运行态”。当 parent turn 已有 final assistant completion 且收到 `turn/completed` 时，主会话 MUST 正常退出 processing；残留 child-agent blocker MUST 只进入 diagnostic，不得继续导致 UI loading。

#### Scenario: final assistant arrives before turn completed while child blocker remains running
- **GIVEN** Codex parent turn 已记录 final assistant completion
- **AND** 仍存在 `collabAgentToolCall`、`Collab: wait` 或 child agent status 为 `running` 的 blocker
- **WHEN** `turn/completed` 到达同一个 parent turn
- **THEN** 系统 MUST 结算 parent turn processing state
- **AND** MUST NOT defer `turn/completed`
- **AND** diagnostic MAY 记录这些 blocker 为 `remainingBlockers`

#### Scenario: turn completed is deferred before final assistant arrives
- **GIVEN** Codex parent turn 收到 `turn/completed`
- **AND** 仍存在 running child-agent blocker
- **AND** 尚未记录 final assistant completion
- **WHEN** final assistant completion 随后到达同一个 parent turn
- **THEN** 系统 MUST flush deferred completion
- **AND** parent session MUST 退出 loading
- **AND** remaining blocker MUST NOT 继续阻塞 parent settlement

#### Scenario: no final assistant completion keeps early-stop protection active
- **GIVEN** Codex parent turn 收到 `turn/completed`
- **AND** 仍存在 running child-agent blocker
- **AND** 尚未记录 final assistant completion
- **WHEN** child-agent blocker 也尚未 terminal
- **THEN** 系统 SHOULD defer parent completion
- **AND** MUST NOT 将 parent session 过早标记为 stopped

#### Scenario: terminal child update releases deferred completion without assistant evidence
- **GIVEN** Codex parent turn 的 completion 已因 running child-agent blocker 被 defer
- **WHEN** 对应 child-agent blocker 更新为 terminal status
- **THEN** 系统 MUST flush deferred completion
- **AND** parent session MUST 退出 loading

### Requirement: Subagent Tree Projection MUST Exclude User Fork Lineage

Sidebar MUST 仅将 engine/runtime authoritative Subagent ownership 投影为 child depth 与 `子代理` 标签；用户主动 Fork 的 parent lineage MUST NOT 复用 Subagent relationship projection。

#### Scenario: real subagent retains nested behavior
- **WHEN** engine/runtime 报告真实 Subagent relationship
- **THEN** Sidebar MUST 继续将 child 嵌套在 parent 下并显示 `子代理` 标签
- **AND** parent MUST 继续遵循既有默认折叠行为

#### Scenario: user fork and subagent remain mutually exclusive
- **WHEN** 同一 workspace 同时存在 user Fork 与真实 Subagent
- **THEN** user Fork MUST 作为 top-level conversation 渲染
- **AND** 真实 Subagent MUST 保持 child projection

#### Scenario: every user fork entrypoint excludes subagent projection
- **WHEN** 用户从 composer Fork quick action 或幕布 message-tail Fork action 创建 conversation
- **THEN** 两个 entrypoint MUST 使用一致的 top-level Fork projection
- **AND** 任一 entrypoint MUST NOT 调用 generic Subagent relationship writer

