## ADDED Requirements

### Requirement: Global Search Results MUST Prioritize Direct Actions And Navigation

系统 SHALL 使用稳定的跨类型优先级呈现 global search results，使 app action、file 与 session/navigation results 排在 message/history content results 之前；同一 kind 内 MUST 保持 unified ranking 产生的相关度顺序。

#### Scenario: Action and message both match
- **WHEN** 同一 query 同时匹配 app action 与 message content
- **THEN** action section 与 action result MUST 排在 message section 前

#### Scenario: File and message both match
- **WHEN** 同一 query 同时匹配 file 与 message content
- **THEN** file section 与 file result MUST 排在 message section 前

#### Scenario: Results share the same kind
- **WHEN** 多个 results 属于同一 kind
- **THEN** 它们 MUST 按 provider score、recency、updatedAt 与 stable title tie-break 排序

### Requirement: Empty Query Sections MUST Remain Keyboard Selectable

SearchPalette SHALL 为 empty-query recent results 显示具名 sections，且 section headings MUST 保持在 selectable result index 之外。

#### Scenario: Keyboard crosses recent sections
- **WHEN** 用户在 recent action、file 与 session sections 之间按 Arrow Up 或 Arrow Down
- **THEN** selection MUST 连续移动到 underlying result
- **AND** Enter MUST 激活当前可见 result

#### Scenario: No recent data exists
- **WHEN** query 为空且没有可用 recent action、file 或 session
- **THEN** palette MUST 显示稳定的 empty presentation
- **AND** MUST NOT 显示不可选的伪 result
