## MODIFIED Requirements

### Requirement: Right Panel Workspace Session Activity Entry

系统 MUST **不再**在右侧 panel 体系中向用户暴露可用的 workspace session activity 入口（runtime disabled）。

#### Scenario: right panel does not expose activity tab

- **WHEN** 用户进入支持 chat canvas 的 workspace
- **THEN** 右侧区域 MUST NOT 提供可用的 `activity` /「会话活动」面板入口
- **AND** Git、Files、Search、Radar、Notes 等其余 panel MUST 保持原有访问方式

#### Scenario: adding activity panel does not replace existing right-side capabilities

- **WHEN** activity 能力处于 disabled 状态
- **THEN** Git、Files、Search、Memory、Radar 等现有 panel MUST 保持原有访问方式与核心行为
- **AND** 系统 MUST NOT 因 activity 下线而移除或替换 runtime console / 消息区工具卡片

#### Scenario: solo mode is disabled as activity container

- **WHEN** 产品曾使用 `SOLO` 作为 activity 监控容器
- **THEN** 系统 MUST NOT 提供可用的 Solo 进入入口
- **AND** 系统 MUST NOT 因 session 进入运行态自动切入 Solo
- **AND** 若本地残留 Solo 态，系统 MUST 在下一次布局 resolve 时退出 Solo

### Requirement: Relevant Session Scope Is Root-Subtree Bound

当 activity 派生未运行时，本 requirement 不适用运行时聚合；若未来重新启用，MUST 仍仅聚合 active thread root-subtree。

#### Scenario: activity derivation is not running while disabled

- **GIVEN** session activity 处于 runtime disabled
- **WHEN** 对话流式更新 items
- **THEN** 系统 MUST NOT 为 activity 面板维护 live timeline 派生
- **AND** Radar 会话跟踪 MUST 不受影响、继续按既有 radar contract 工作

### Requirement: Multi-Session Timeline Coverage

在 runtime disabled 期间，系统 MUST NOT 渲染 workspace session activity 多会话时间线 UI。

#### Scenario: panel is not mounted

- **WHEN** 用户尝试打开 activity（含旧快捷键、旧 `filePanelMode` 残留）
- **THEN** 系统 MUST NOT 挂载 `WorkspaceSessionActivityPanel` 作为可用主视图
- **AND** 系统 MUST 将右侧面板 normalize 到安全模式（例如 files）
- **AND** 系统 MUST NOT crash

### Requirement: Realtime Incremental Refresh

在 runtime disabled 期间，系统 MUST NOT 为 activity 执行增量 timeline 刷新逻辑。

#### Scenario: streaming does not rebuild activity view model

- **GIVEN** session activity 处于 runtime disabled
- **WHEN** 相关 session 产生 tool / file-change 事件
- **THEN** 系统 MUST NOT 调用 `useWorkspaceSessionActivity` 进行全量或增量重建
- **AND** 主对话渲染 MUST 保持可用

## ADDED Requirements

### Requirement: Session Activity And Solo Runtime Kill-Switch

系统 MUST 提供明确的 runtime kill-switch，使会话活动与 Solo 同时不可用，且不删除雷达能力。

#### Scenario: kill-switch hides activity and solo together

- **WHEN** kill-switch 生效（本 change 默认生效）
- **THEN** activity 入口与 Solo 入口均不可用
- **AND** Radar 入口与 radar 数据路径 MUST 仍可用

#### Scenario: persisted activity mode is sanitized

- **WHEN** 客户端存储中 `filePanelMode` 为 `activity` 或 Solo 标记为开启
- **THEN** 系统 MUST 在布局解析时纠正为非 activity 安全状态
- **AND** MUST NOT 保留半开 Solo + activity 组合
