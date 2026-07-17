# workspace-sidebar-session-loading Specification

## Purpose

定义 workspace sidebar session hydration 的 foreground priority、idle prewarm、request deduplication、stale-result rejection 与 interaction responsiveness contract。

## Requirements

### Requirement: Workspace Sidebar Hydration MUST Be Staged And Deduplicated

系统 MUST 按 foreground priority 分阶段加载 workspace sidebar sessions，并确保同一 workspace/query generation 不会并发启动重复 hydration。

#### Scenario: active workspace hydrates before idle workspaces

- **WHEN** 应用恢复多个 workspaces
- **THEN** active workspace MUST 先进入 hydration
- **AND** inactive workspaces MUST 通过 bounded idle scheduling 预热
- **AND** inactive hydration MUST NOT block the active-workspace ready milestone

#### Scenario: duplicate hydration request reuses current work

- **WHEN** 同一 workspace 在 loading 或 in-flight 状态再次收到等价 hydration 请求
- **THEN** 系统 MUST skip or reuse the current work
- **AND** MUST NOT issue a duplicate full-catalog request

### Requirement: Workspace Sidebar Hydration MUST Reject Stale Results

系统 MUST 使用 request sequence 或等价 query identity 识别旧 hydration 结果。

#### Scenario: older request finishes after a newer refresh

- **WHEN** 较旧请求在较新 workspace/query refresh 之后完成
- **THEN** 旧结果 MUST NOT overwrite the newer projection
- **AND** discarded work MUST NOT mark the workspace fully hydrated

### Requirement: Background Hydration MUST Preserve Foreground Responsiveness

后台 session hydration MUST NOT introduce high-frequency root polling or block
thread selection, Composer input, or visible sidebar interaction.

#### Scenario: user switches thread during background hydration

- **WHEN** inactive or related workspace catalog hydration is running
- **AND** 用户切换当前 thread 或继续输入
- **THEN** foreground interaction MUST remain available
- **AND** existing visible rows MAY remain during refresh
- **AND** loading/degraded state MUST be represented separately from row membership
