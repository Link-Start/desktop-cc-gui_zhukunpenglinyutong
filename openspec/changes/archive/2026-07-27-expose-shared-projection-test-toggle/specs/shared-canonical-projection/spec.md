## ADDED Requirements

### Requirement: Shared Projection Test Control MUST Be Discoverable And Reversible

系统 MUST 在 `设置 → 其他设置` 提供默认关闭的 Shared Projection 测试开关。
该开关 MUST 复用现有 localStorage feature flag，MUST 明确标注 dark-launch
测试用途，且 MUST NOT 改变真实 Shared Send 写路径。

#### Scenario: Tester enables Shared Projection

- **WHEN** 测试者开启 Shared Projection 测试开关
- **THEN** 系统 MUST 写入 `mossx.sharedProjection=1`
- **AND** 系统 MUST 刷新当前 WebView，使 Shared history loader 重新选择数据源

#### Scenario: Tester disables Shared Projection

- **WHEN** 测试者关闭 Shared Projection 测试开关
- **THEN** 系统 MUST 删除 `mossx.sharedProjection` local override
- **AND** 系统 MUST 刷新当前 WebView，使默认 V0 路径重新生效

#### Scenario: Projection loading fails after enablement

- **WHEN** 测试开关已开启但 Shared Projection command 失败
- **THEN** 系统 MUST 可观测地回退到 V0 snapshot
- **AND** 测试入口 MUST NOT 修改或删除 Legacy snapshot

### Requirement: Foundation Checklist MUST Expose User-Visible Impact

多 CLI × 多 Provider 会话基石总任务清单 MUST 为 Wave 0–6 的每个任务明确说明
大白话目的、系统改变点与 UI 变化，且 MUST 保留原任务状态与阶段边界。

#### Scenario: Reader scans a task row

- **WHEN** 读者查看 Wave 0–6 任一任务
- **THEN** 该行 MUST 能直接判断任务解决什么问题
- **AND** 该行 MUST 能区分无 UI、间接 UI、仅开发者可见或用户可见变化

#### Scenario: Reader distinguishes Change A from Change B

- **WHEN** 读者查看 Change A 与 Change B 的任务说明
- **THEN** Change A MUST 标记为 dark launch 或默认无产品 UI 变化
- **AND** Change B MUST 明确标出真实 Send、Provider Binding 与用户操作面的计划变化
