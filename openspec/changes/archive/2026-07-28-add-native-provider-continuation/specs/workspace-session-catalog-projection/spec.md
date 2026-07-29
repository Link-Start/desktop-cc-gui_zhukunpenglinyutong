## ADDED Requirements

### Requirement: Workspace Projection MUST Preserve Continuation Origin And Family

Session catalog metadata 与 frontend projection MUST 暴露
`provider-continuation` Origin、`familyId`、`familyRootSessionId`、
`lineageParentSessionId`、`lineageKind` 与 `lineageDepth`。

#### Scenario: continuation inherits source family

- **WHEN** 来源 Session 已有 authoritative Conversation Family
- **THEN** Continuation MUST 继承相同 `familyId` 与 `familyRootSessionId`
- **AND** `lineageParentSessionId` MUST 指向来源且 depth 增加一

#### Scenario: legacy root receives deterministic family

- **WHEN** 来源 Native Session 没有 authoritative lineage metadata
- **THEN** 系统 MUST 以来源 stable session key 建立独立 Family
- **AND** MUST NOT 按标题、时间或内容相似度猜测血缘

### Requirement: Provider Continuation MUST Remain A Top-Level Sidebar Session

Provider Continuation MUST 显示“供应商续接” Origin 标签和目标 Engine/Provider，并提供来源
导航；MUST NOT 设置 `parentThreadId`、进入 Subagent tree 或显示“子代理”。

#### Scenario: continuation renders at top level

- **WHEN** Sidebar 投影一个 Provider Continuation
- **THEN** row MUST 位于顶层并显示“供应商续接”
- **AND** MUST NOT 因 `lineageParentSessionId` 嵌套到来源下面

#### Scenario: deleted source does not delete continuation

- **WHEN** 来源 Session 被删除或归档
- **THEN** Continuation MUST 保持可见且可独立恢复
- **AND** 来源导航 MUST 显示不可用而不是级联删除
