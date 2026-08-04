# session-activity-file-open-affordances Specification

## Purpose

Defines the session-activity-file-open-affordances behavior contract, covering Activity Panel Primary File Click MUST Open The File And Maximize The Editor Surface.
## Requirements
### Requirement: Activity Panel Primary File Click MUST Open The File And Maximize The Editor Surface

当 workspace session activity 面板 **可用** 时，文件条目主点击 MUST 打开目标文件并在支持时最大化 editor surface。  
当 activity 处于 **runtime disabled** 时，本 requirement 的 UI 路径 MUST 不可达，系统 MUST NOT 因此崩溃。

#### Scenario: primary click is unreachable while activity disabled

- **GIVEN** session activity 处于 runtime disabled
- **WHEN** 用户无法打开 activity 面板
- **THEN** 系统 MUST NOT 暴露 activity 文件主点击 affordance
- **AND** 既有 Files / Search / 消息区文件打开路径 MUST 保持可用

### Requirement: Activity Panel MUST Provide A Separate Diff Preview Affordance

右侧 `workspace session activity` 文件条目 MUST 提供独立 diff icon 按钮，用于打开该文件的 diff 预览窗体。

#### Scenario: diff icon opens diff preview without replacing current layout

- **WHEN** 用户点击 activity panel 文件条目的 diff icon
- **THEN** 系统 MUST 打开该文件的 diff 预览窗体或等效 diff modal
- **AND** 当前主布局上下文 MUST 保持可恢复

#### Scenario: primary click and diff icon remain semantically separate

- **WHEN** 用户点击文件主区域或 diff icon
- **THEN** 主区域 MUST 表示“打开文件并最大化”
- **AND** diff icon MUST 表示“打开 diff 预览”
- **AND** 两个入口 MUST NOT 互相覆盖或交换语义

### Requirement: Activity Panel File Affordances MUST Reuse Existing Routing Contracts

右侧文件打开与 diff 预览的新增 affordance MUST 建立在既有 path routing 与 diff-entry contract 上，而不是创建并行打开系统。

#### Scenario: activity panel reuses existing file and diff open pipelines

- **WHEN** activity panel 触发文件打开或 diff 预览
- **THEN** 系统 MUST 复用既有 `onOpenDiffPath`、workspace file-open、external spec open 或等效现有链路
- **AND** 其他入口的既有打开行为 MUST 保持不变

#### Scenario: unresolvable target fails recoverably

- **WHEN** 用户点击的文件路径无法解析为可用打开目标或 diff 目标
- **THEN** 系统 MUST 提供 recoverable hint
- **AND** activity panel 其余内容与交互 MUST 保持可用

### Requirement: Open File Tabs MUST Provide Detached File Open Affordance

已打开文件 tab MUST 提供独立窗口打开入口，使用户可以从主编辑区 tab 直接在新的 detached file explorer 实例中打开对应文件。

#### Scenario: tab detached icon opens that tab file

- **WHEN** 用户点击已打开文件 tab 上的独立窗口 icon
- **THEN** 系统 MUST 创建新的 detached file explorer 窗口实例
- **AND** detached file explorer MUST 将该 tab 对应文件作为初始打开文件

#### Scenario: tab detached icon opens an independent screen

- **WHEN** 用户连续点击一个或多个文件 tab 上的独立窗口 icon
- **THEN** 每次点击 MUST 创建独立的 detached file explorer 窗口实例
- **AND** 新实例 MUST NOT 复用或重定向既有 tab detached window

#### Scenario: tab detached window prioritizes reading space

- **WHEN** detached file explorer 由文件 tab 独立窗口 icon 创建
- **THEN** 该窗口 MUST 默认收起左侧 file tree sidebar
- **AND** 用户 MUST 仍可通过窗口内 sidebar toggle 重新展开
- **AND** 该默认折叠偏好 MUST 在 per-window session 异步恢复后仍生效

#### Scenario: detached file window can be dragged from its chrome

- **WHEN** 用户打开文件 tab 的独立窗口实例
- **THEN** 窗口顶部 menubar MUST 提供可拖拽区域
- **AND** menubar 标题文字区域 MUST NOT 阻断窗口拖拽
- **AND** 动态 `file-explorer-*` 窗口 MUST 拥有与固定 `file-explorer` 窗口一致的 Tauri window capability
- **AND** 文件内容 header、tab 主按钮、detached icon 与 close button MUST NOT 被改造成窗口拖拽区

#### Scenario: tab detached icon does not replace tab activation or close semantics

- **WHEN** 用户点击已打开文件 tab 上的独立窗口 icon
- **THEN** 系统 MUST NOT 关闭该 tab
- **AND** 系统 MUST NOT 因该按钮点击触发 tab 主区域的激活逻辑

#### Scenario: detached open failure is recoverable

- **WHEN** detached file explorer 创建、聚焦或 session 发送失败
- **THEN** 系统 MUST 向用户展示可恢复错误反馈
- **AND** 当前文件 tab 与主编辑区 MUST 保持可用

### Requirement: Activity Panel Diff Icon Opens Diff Preview

当 activity 面板可用时，文件条目 MUST 提供独立 diff icon。  
当 activity disabled 时，该 affordance MUST 不可达。

#### Scenario: diff icon is unreachable while activity disabled

- **GIVEN** session activity 处于 runtime disabled
- **WHEN** 用户浏览右侧面板
- **THEN** 系统 MUST NOT 要求渲染 activity 内 diff icon
- **AND** Git panel 的 diff 打开路径 MUST 保持可用
