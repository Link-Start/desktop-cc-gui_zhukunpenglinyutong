## MODIFIED Requirements

### Requirement: Usage Panel Uses Shared Rate-Limit Snapshot

实时用量面板与本地 `/status` MUST 使用同源的 rate-limit 快照数据，并 MUST 根据各 limit window 的 `windowDurationMins` 动态派生标题。

#### Scenario: panel renders duration-derived labels from shared snapshot

- **WHEN** 用户展开“实时用量”面板
- **THEN** `300` 分钟窗口 MUST 渲染为 `5h limit`
- **AND** `10080` 分钟窗口 MUST 渲染为 `Weekly limit`
- **AND** 其他有效窗口 MUST 按分钟、小时或天生成对应 limit title
- **AND** 重置时间 MUST 来自同一 snapshot 字段

#### Scenario: local status uses the same duration-derived labels

- **WHEN** 本地 `/status` fallback 渲染 rate-limit 状态
- **THEN** 每个 limit title MUST 使用与 Usage panel 相同的 duration formatter
- **AND** title MUST NOT 依赖 primary / secondary 的固定位置语义

#### Scenario: missing duration remains renderable

- **WHEN** rate-limit snapshot 缺失窗口时长或提供 invalid duration
- **THEN** Usage panel 与本地 `/status` MUST 显示 `Rate limit`
- **AND** 输入区与 status rendering MUST NOT 抛出异常

#### Scenario: remaining/used display respects global setting

- **GIVEN** `usageShowRemaining` 设置切换
- **WHEN** 面板计算百分比文案
- **THEN** MUST 按设置显示“剩余”或“已使用”
