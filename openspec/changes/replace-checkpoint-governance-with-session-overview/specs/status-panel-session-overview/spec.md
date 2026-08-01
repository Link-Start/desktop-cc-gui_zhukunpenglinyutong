# status-panel-session-overview Spec Delta

## ADDED Requirements

### Requirement: 结果 Tab MUST 默认展示会话概览 Section

dock status panel 的「结果」tab MUST 在顶部常驻渲染会话概览 section(`SessionOverviewSection`),其全部字段 MUST 来自既有前端 store / props 的确定性派生,MUST NOT 新增 tauri command、MUST NOT 引入轮询、MUST NOT 依赖大模型生成。

#### Scenario: 概览字段来源固定

- **WHEN** 「结果」tab 渲染会话概览
- **THEN** engine / model MUST 来自 `selectedEngine` / `selectedModelId`
- **AND** workspace 标识 MUST 来自 `workspaceName`(可回退 `workspacePath`)
- **AND** 运行状态与时长 MUST 来自 `isProcessing` 与 `threadStatusById`(`processingStartedAt` / `lastDurationMs` / `isContextCompacting`)
- **AND** 消息与 turn 统计 MUST 来自当前 thread 的 conversation items
- **AND** 上下文占用 MUST 来自 `activeTokenUsage`
- **AND** rate limit MUST 来自 `activeRateLimits`
- **AND** 待处理计数 MUST 来自 `approvals` / `userInputRequests`(与消息流内嵌卡片同源)

#### Scenario: 缺失字段降级为不渲染

- **WHEN** 某一概览字段的数据源缺失(如无 `activeTokenUsage`、无 rate limit 快照)
- **THEN** 对应行 MUST 整体不渲染
- **AND** section MUST NOT 渲染 placeholder 或 `undefined` 文案

#### Scenario: 零待处理不常显

- **WHEN** `approvals` 与 `userInputRequests` 均为空
- **THEN** 待处理计数行 MUST NOT 渲染

#### Scenario: 无活跃会话时展示空态

- **WHEN** 当前没有活跃 thread 且没有任何概览数据
- **THEN** 会话概览 MUST 渲染本地化空态文案
- **AND** MUST NOT 崩溃或阻塞「结果」tab 其余 section

### Requirement: 会话概览 MUST NOT 与成本 Section 重复表达

会话概览 MUST 聚焦会话身份、运行状态、活动统计、上下文占用与待处理计数;token 五维拆分与成本金额 MUST 仍由 `CostBudgetSection` 表达,会话概览 MUST NOT 重复渲染成本金额。

#### Scenario: 概览不渲染成本

- **WHEN** 会话概览与 `CostBudgetSection` 同屏渲染
- **THEN** 会话概览 MUST NOT 出现 session 成本金额或预算条
