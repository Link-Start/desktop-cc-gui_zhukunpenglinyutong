## ADDED Requirements

### Requirement: Turn File Summary Rows MUST Request Modal Diff Preview

conversation turn 与 session file summary 中的文件行在 host 提供 preview capability 时 MUST 成为 accessible modal diff action，并且 MUST 保持 conversation Surface 不变。

#### Scenario: pointer activation opens modal request

- **WHEN** 用户点击“已编辑 N 个文件”卡片中的可见文件行
- **THEN** 系统 MUST 使用该文件的完整 workspace-relative path 发出 modal diff preview request
- **AND** request MUST 要求 modal 初始最大化
- **AND** 系统 MUST NOT 调用 center-panel `onOpenDiffPath`

#### Scenario: keyboard activation matches pointer behavior

- **WHEN** 用户聚焦 summary file button 并按 Enter 或 Space
- **THEN** 系统 MUST 发出与 pointer activation 相同的 modal preview request

#### Scenario: show-more remains independent

- **WHEN** 用户激活“再显示 N 个文件”
- **THEN** 系统 MUST 只展开隐藏文件
- **AND** MUST NOT 发出任何 modal diff preview request

#### Scenario: preview capability unavailable

- **WHEN** host 未提供 modal preview callback
- **THEN** summary files MUST 保持稳定的非交互展示
- **AND** 系统 MUST NOT 抛出 runtime error

#### Scenario: both summary placements share the action

- **WHEN** 文件汇总渲染在历史回合边界或 timeline 末尾会话累计位置
- **THEN** 两种 placement MUST 提供相同的 modal preview behavior
