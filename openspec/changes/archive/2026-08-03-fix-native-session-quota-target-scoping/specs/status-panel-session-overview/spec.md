# status-panel-session-overview Spec Delta

## ADDED Requirements

### Requirement: 会话概览额度 target 收集 MUST 按 session kind 分岔

「结果」tab 会话概览的供应商套餐额度查询 target 集合 MUST 按当前活跃会话的 kind 决定：

- **Native session**（`threadKind !== "shared"`）：target 集合 MUST 仅包含当前会话绑定的 engine 与 `providerProfileId`（及当前 model 展示元数据）；MUST NOT 从 conversation history 的 `executionTargetSnapshot` / `engineSource` 收集其它供应商。
- **Shared session**（`threadKind === "shared"`）：target 集合 MAY 从当前 thread conversation items 的 `executionTargetSnapshot`（及必要时 `engineSource`）去重收集，并 MUST 包含当前 fallback binding，以支持多供应商并行额度展示。

#### Scenario: Native 不展示历史其它供应商额度

- **WHEN** 活跃会话为 Native
- **AND** conversation items 中存在与当前 `providerProfileId` 不同的 `executionTargetSnapshot`（例如历史 kimi / minimax profile）
- **THEN** 会话概览额度区 MUST NOT 为这些历史供应商发起额度查询或渲染额度卡
- **AND** 至多展示当前 binding 对应的一条额度结果（含 unsupported / empty / coding_plan / official_cli）

#### Scenario: Shared 仍展示多供应商额度列表

- **WHEN** 活跃会话为 Shared
- **AND** conversation items 中出现多个不同的 engine+provider 目标
- **THEN** 会话概览 MUST 为去重后的每个目标独立查询并分卡展示额度
- **AND** 当前 fallback binding 若尚未出现在 history 中 MUST 仍被包含

#### Scenario: 无 engine 时不查询

- **WHEN** 当前无有效 `selectedEngine` / status panel engine
- **THEN** 系统 MUST NOT 发起 coding plan 额度查询
- **AND** 会话概览 MUST NOT 因额度逻辑崩溃

## MODIFIED Requirements

无（本 delta 仅追加额度 target 范围契约；既有字段来源 / 空态 / 与 CostBudget 去重契约保持不变）。
