## ADDED Requirements

### Requirement: Codex User Fork MUST Be A Top-Level Sidebar Conversation

系统 MUST 将用户主动创建的 Codex Fork 作为独立顶层 conversation 投影；native `thread/fork` 返回的 lineage MUST NOT 被 frontend generic Subagent relationship store 解释为 Subagent ownership。

#### Scenario: Codex fork is visible without expanding parent
- **WHEN** 用户从 Codex conversation 创建 Fork
- **THEN** parent 与 forked conversation MUST 在 Sidebar 顶层并列可见
- **AND** forked conversation MUST NOT 显示 `子代理` 标签

#### Scenario: Codex fork does not mutate real subagent projection
- **WHEN** workspace 同时包含 user-created Codex Fork 与 engine-created Codex Subagent
- **THEN** 只有 engine-created Subagent MUST 嵌套于其 parent
- **AND** user-created Fork MUST 保持顶层会话
