## ADDED Requirements

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
