## MODIFIED Requirements

### Requirement: Shared parent replaces hidden native owner

Shared 场景下，子会话 parent 指向被隐藏的 native owner 时，系统 MUST 将会话树上的挂载点改为对应 `shared:` 父会话。

Parent 匹配 MUST 为引擎无关，且 MUST 覆盖 native id 形态变体（至少：raw session id 与 `engine:raw`，engine ∈ Claude / Codex / Grok / Kimi / OpenCode）。系统 MUST NOT 仅因 hidden owner 已从侧栏 strip、而 child 仍携带指向该 owner 的 parent 元数据，就把该 child 投影为顶层根会话。

本要求只改写会话树 `parentThreadId` 挂载点；MUST NOT 因此删除子会话行（子会话仍可供侧栏树、Strip、childSubagent 消费），也 MUST NOT 放宽 Shared Hidden Native Binding 的 id hide 规则。

#### Scenario: shared grok children re-parented

- **WHEN** Shared Grok 会话的子代理 parent 是 hidden 的 `grok:` owner
- **THEN** 会话树 MUST 把子代理挂在 `shared:` 父会话下
- **AND** 详情/点击导航 MUST 使用与侧栏一致的子会话 id

#### Scenario: shared codex children re-parented across id shapes

- **WHEN** Shared Codex 会话的 hidden native owner 在 binding 中记为 `codex:{uuid}`（或 raw `{uuid}`）
- **AND** 子会话 `parentThreadId` / `parent_thread_id` 为对端形态（raw 或 `codex:{uuid}`）
- **THEN** 会话树 MUST 把该子会话挂在对应 `shared:` 父会话下
- **AND** MUST NOT 将该子会话显示为与 Shared 并列的顶层根

#### Scenario: shared claude children re-parented across id shapes

- **WHEN** Shared Claude 会话的 hidden native owner 为 `claude:{sessionId}` 或 raw `{sessionId}`
- **AND** 子会话 parent 为对端形态
- **THEN** 会话树 MUST 把该子会话挂在对应 `shared:` 父会话下

#### Scenario: non-shared native parent links stay untouched

- **WHEN** 子会话 parent 指向普通可见 native 父会话（非任何 Shared 的 hidden native owner）
- **THEN** 系统 MUST NOT 改写该 `parentThreadId`
- **AND** 侧栏 MUST 继续将子会话挂在该 native 父下

#### Scenario: missing parent metadata is not inferred

- **WHEN** 子会话没有 authoritative parent 元数据
- **THEN** 系统 MUST NOT 仅凭标题、昵称或 agent 名推断 Shared 父子关系
- **AND** 既有 id hide / control-plane title hide 规则 MUST 保持独立生效
