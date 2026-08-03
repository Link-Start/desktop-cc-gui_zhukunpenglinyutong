# status-panel-checkpoint-module Spec Delta

## MODIFIED Requirements

### Requirement: Bottom Status Panel MUST Replace Legacy Edits Tab With A Checkpoint Result Surface

系统 MUST 用新的 `Checkpoint` 结果模块替换底部 `status panel` 中旧的 `Edits` 主语义，并使用更贴近用户判断习惯的本地化 tab 文案，例如 `结果 / Result`。「结果」tab MUST 常驻渲染会话概览 section;checkpoint 详情表面(总结 hero、验证、文件变化、提交等)与成本区 MUST 默认隐藏,仅在用户通过 `bottomActivity.checkpointDetails` 可见性开关 opt-in 后渲染;tab badge 的 verdict 徽标 MUST 与详情渲染解耦,始终照常计算。

#### Scenario: dock status panel shows checkpoint instead of legacy edits

- **WHEN** 用户打开底部 `dock` 状态面板
- **THEN** 系统 MUST 展示新的 `结果` tab
- **AND** 系统 MUST NOT 继续把旧 `Edits` 作为用户主语义展示

#### Scenario: checkpoint details are opt-in behind a visibility control

- **WHEN** 用户从未启用 `bottomActivity.checkpointDetails` 开关
- **THEN** 「结果」tab MUST 只渲染会话概览
- **AND** MUST NOT 渲染 checkpoint 详情表面或成本区
- **AND** tab badge 的 verdict MUST 照常由会话内信号计算

#### Scenario: replacing edits does not replace right-side session activity

- **WHEN** 系统引入新的 `Checkpoint` 结果模块后
- **THEN** 右侧 `session activity` MUST 保持独立存在
- **AND** `Checkpoint` MUST NOT 退化为右侧 activity 的缩小复刻

#### Scenario: popover status panel also stops exposing legacy edits semantics

- **WHEN** 用户打开 composer 上方的 popover status panel
- **THEN** 系统 MUST 使用与 `dock` 一致的 `Checkpoint/结果` 语义
- **AND** popover MUST NOT 残留 legacy `Edits` 主语义

#### Scenario: popover may stay compact while preserving verdict parity

- **WHEN** `Checkpoint` 在 popover status panel 中渲染
- **THEN** 系统 MAY 使用更紧凑的布局
- **AND** 其 verdict 与 evidence MUST 与 dock 版本保持同源一致
