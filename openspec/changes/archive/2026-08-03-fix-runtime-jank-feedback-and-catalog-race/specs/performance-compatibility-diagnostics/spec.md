## ADDED Requirements

### Requirement: Renderer Diagnostics Persistence MUST Be Incremental And Non-Self-Amplifying

Renderer diagnostics 持久化 MUST 以有界 canonical snapshot 增量合并新 entries，不得在每次 throttle flush 中重复读取、normalize 和逐项序列化全部历史记录。

#### Scenario: Buffered diagnostics flush after initial load

- **WHEN** persisted diagnostics 已初始化且新 entries 到达
- **THEN** flush 成本 MUST 由新增 entries 与 retention trim 决定
- **AND** 系统 MUST NOT 为本次 flush 重读和重新去重全部 persisted history

#### Scenario: Persistence work causes a long frame

- **WHEN** diagnostics persistence 自身被 frame monitor 观测为 long task 或 frame drop
- **THEN** 系统 MUST 防止该 observation 形成无界的 diagnostics persistence feedback loop
- **AND** 其他来源的 frame evidence MUST 继续保留

#### Scenario: Application reloads or diagnostics are cleared

- **WHEN** 应用 reload 后首次访问 diagnostics，或用户清空 diagnostics
- **THEN** canonical snapshot MUST 与 persisted store 重新同步
- **AND** export、retention 与 content-safety 行为 MUST 保持现有契约
