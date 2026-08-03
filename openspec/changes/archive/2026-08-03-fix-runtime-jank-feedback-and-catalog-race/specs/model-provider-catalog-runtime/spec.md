## ADDED Requirements

### Requirement: Catalog Refresh MUST Use One Atomic Conversation Scope

模型目录刷新 MUST 从同一个 active conversation snapshot 获取 engine 与 provider identity，不得组合新 thread 的 provider 与尚未收敛的 global engine。

#### Scenario: Cross-engine thread navigation observes transient global engine

- **WHEN** 用户从 Claude thread 切换到 Codex thread，或反向切换
- **AND** global engine 切换尚未完成
- **THEN** catalog request MUST 使用目标 thread 自身的 engine 与 provider scope
- **AND** 系统 MUST NOT 向一个 engine 发送属于另一个 engine 的 provider profile

#### Scenario: Transient scope cannot be validated

- **WHEN** active conversation scope 缺少必要 identity 或 engine/provider 归属不一致
- **THEN** 系统 MUST 跳过该 transient refresh
- **AND** last-good catalog MUST 保持可用，不得被空结果覆盖

#### Scenario: Refresh returns semantically unchanged catalog

- **WHEN** catalog refresh 返回与当前 catalog 内容等价的 entries
- **THEN** frontend MUST 保持现有 state identity
- **AND** 不得仅因数组引用变化触发下游 render
