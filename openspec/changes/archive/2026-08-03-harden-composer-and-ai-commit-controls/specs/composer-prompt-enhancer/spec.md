## ADDED Requirements

### Requirement: Prompt enhancer cache and async results MUST be workspace isolated

Prompt Enhancer 的 cached result 与 in-flight result MUST 绑定发起请求时的 `workspaceId`，不得跨 workspace 复用或写回。

#### Scenario: Same prompt runs in two workspaces

- **WHEN** workspace A 已缓存某 text/engine/model/locale 的增强结果，用户在 workspace B 对相同输入运行增强
- **THEN** workspace B MUST NOT 命中 workspace A 的 cache entry
- **AND** 系统 MUST 使用 workspace B 发起独立 engine request

#### Scenario: Workspace changes while enhancement is running

- **WHEN** workspace A 的增强请求仍在执行且当前 Composer 切换到 workspace B
- **THEN** workspace A 的 eventual result MUST 被视为 stale
- **AND** 该结果 MUST NOT 写入 workspace B 的 dialog 或 cache identity
