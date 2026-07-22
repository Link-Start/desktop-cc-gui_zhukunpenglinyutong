## ADDED Requirements

### Requirement: Desktop titlebar SHALL expose an independent Quick Switcher entry

系统 SHALL 在 desktop titlebar 的 Global Search icon 相邻位置展示 Quick Switcher icon，并 SHALL 使用 `⌘E` / `Ctrl+E` 打开或关闭该面板。Global Search 的 `⌘O` / `Ctrl+O` 行为 MUST 保持不变。

#### Scenario: Open from titlebar icon
- **WHEN** desktop 用户点击 Quick Switcher icon
- **THEN** 系统打开 Quick Switcher modal
- **AND** icon MUST 具有包含 shortcut 的 accessible label/tooltip

#### Scenario: Toggle from keyboard
- **WHEN** 非 editable target 聚焦且用户按下 platform 对应的 `⌘E` / `Ctrl+E`
- **THEN** 系统 MUST 切换 Quick Switcher open state

#### Scenario: Compact layouts preserve existing chrome
- **WHEN** 客户端处于 phone、tablet 或 compact layout
- **THEN** 系统 MUST NOT 展示 Quick Switcher titlebar icon
- **AND** MUST NOT 拦截该布局已有快捷键行为

### Requirement: Quick Switcher SHALL remain a compact non-search navigation surface

Quick Switcher SHALL 使用三栏、有限高度的 modal presentation。面板 MUST NOT 提供 search input、typing filter、content filter 或 provider hydration 状态。

#### Scenario: Panel opens with compact chrome
- **WHEN** Quick Switcher 打开
- **THEN** header MUST 仅展示 localized title 与 shortcut badge
- **AND** body MUST 并行展示 navigation、recent sessions、recent files 三个 pane
- **AND** footer MUST 展示 keyboard hints

#### Scenario: Large recent collections remain bounded
- **WHEN** 最近会话与最近文件均达到 30 条
- **THEN** panel MUST 保持 bounded viewport
- **AND** recent pane MUST 可滚动
- **AND** section heading MUST 保持清晰的视觉归属

### Requirement: Recent context SHALL be separated into session and file sections

右侧区域 MUST 将 `最近会话` 与 `最近文件` 显示为两个并行 pane，MUST NOT 上下堆叠或混排为一个扁平列表。每个 pane MUST 展示语义 icon、localized heading 和可见数量，并 MUST 在 pane 内按 workspace 分组。

#### Scenario: Both recent kinds are available
- **WHEN** 已加载 workspace 中同时存在最近会话与最近文件
- **THEN** 系统 MUST 分别渲染 session section 与 file section
- **AND** 每栏 MUST 先取全局最新 30 条，再按 workspace 分组
- **AND** workspace group 与组内 item MUST 按各自最新时间倒序

#### Scenario: One section is empty
- **WHEN** 任一 recent section 没有 item
- **THEN** 该 section MUST 保持独立 heading 并显示紧凑 localized empty state
- **AND** 另一 section 的内容 MUST 保持可用

### Requirement: Recent sessions SHALL use canonical thread timestamps and a 30-item window

系统 MUST 从所有已加载 workspace 的 `ThreadSummary` 派生最近会话，按 `updatedAt` 全局倒序取最多 30 条，再按 workspace 分组。系统 MUST NOT 为 Quick Switcher 复制第二套 persistent session history。

#### Scenario: More than 30 threads are loaded
- **WHEN** 所有已加载 workspace 合计超过 30 个有效 thread summaries
- **THEN** 系统 MUST 只展示 `updatedAt` 最新的 30 条

#### Scenario: Activate a recent session
- **WHEN** 用户激活 Quick Switcher 中的 session row
- **THEN** 系统 MUST 使用该 row 的明确 `workspaceId + threadId` 调用既有 session navigation
- **AND** MUST 遵循现有 editor split preservation contract
- **AND** Quick Switcher MUST 关闭

### Requirement: Recent files SHALL merge trusted user-open and AI-change facts

系统 MUST 建立 workspace-scoped recent-file MRU。用户打开/激活文件与 completed AI file-change facts SHALL 进入 MRU；read、search、list 或文本提及 MUST NOT 进入 MRU。

#### Scenario: User opens or activates a file
- **WHEN** 用户通过任一现有 file-open/file-tab activation path 打开文件
- **THEN** 系统 MUST 以当前时间记录或刷新该 workspace/path MRU entry

#### Scenario: AI completes a file mutation
- **WHEN** Session Activity 提供 `kind=fileChange`、`status=completed` 且 status 为 `A`、`M` 或 `R` 的 file fact
- **THEN** 系统 MUST 使用 fact 的 `occurredAt` 记录或刷新该 workspace/path MRU entry
- **AND** row MUST 暴露轻量 AI-modified visual indicator

#### Scenario: Read-only AI activity is observed
- **WHEN** AI 仅执行 read、search、list 或只在文本中提及 file path
- **THEN** 系统 MUST NOT 新增或刷新 recent-file entry

#### Scenario: AI deletes a known recent file
- **WHEN** completed file-change fact 将 path 标记为 `D`
- **THEN** 系统 MUST 从对应 workspace MRU 移除该 path

### Requirement: Recent-file MRU SHALL be deterministic, persistent, and bounded

Recent-file identity MUST 使用 `workspaceId + normalized path`。同 identity MUST 合并；展示时跨 workspace 按 `touchedAt` 全局倒序取最多 30 条，再按 workspace 分组。每个 workspace 的持久化 MRU 继续独立裁剪为 30 条。

#### Scenario: Reopen an existing recent file
- **WHEN** 已存在的 path 再次被打开或修改
- **THEN** 系统 MUST 刷新其 timestamp 并移动到列表顶部
- **AND** MUST NOT 产生重复 row

#### Scenario: Application restarts
- **WHEN** client stores 已 preload 且 Quick Switcher 首次读取 workspace MRU
- **THEN** 系统 MUST 从 normalized persisted data 恢复最近文件
- **AND** malformed entries MUST fail closed

#### Scenario: File window exceeds the limit
- **WHEN** 写入会使 workspace MRU 超过 30 条
- **THEN** 系统 MUST 在单次 merge 中排序并裁剪至最新 30 条

### Requirement: Quick Switcher SHALL provide complete icon and keyboard semantics

每个 navigation row、session row、file row 和 section heading MUST 具有语义 icon。面板 MUST 支持 `↑/↓`、`←/→`、`Enter`、`Esc`，且 section heading MUST NOT 占用 selectable index。

#### Scenario: Navigate between panes and rows
- **WHEN** 用户使用方向键
- **THEN** `←/→` MUST 在 navigation、sessions、files 三个 pane 间切换
- **AND** `↑/↓` MUST 在当前 pane 的 selectable rows 内移动
- **AND** selection MUST 保持可见

#### Scenario: Activate selection
- **WHEN** 用户按 `Enter`
- **THEN** 系统 MUST 激活当前 selected navigation/session/file row
- **AND** 关闭 Quick Switcher

#### Scenario: Dismiss panel
- **WHEN** 用户按 `Esc` 或点击 overlay
- **THEN** Quick Switcher MUST 关闭并释放 panel-level event listener

#### Scenario: Current context is first in recency order
- **WHEN** 当前 active session/file 是对应 section 的第一条且存在下一条 selectable recent item
- **THEN** initial selection MUST 优先落在下一条 item
- **AND** 支持无需额外定位的快速往返

### Requirement: Quick navigation SHALL reuse canonical module open actions

快速导航 MUST 包含 Spec Hub、意图画布和项目地图，并 MUST 调用各模块已有 canonical open action。

#### Scenario: Open detached Spec Hub
- **WHEN** 用户激活 Spec Hub navigation row
- **THEN** 系统 MUST 调用现有 `handleOpenSpecHub`
- **AND** MUST 创建或聚焦 detached Spec Hub window，而不是切换 legacy in-shell tab

#### Scenario: Open visual workspace tools
- **WHEN** 用户激活意图画布或项目地图 navigation row
- **THEN** 系统 MUST 分别调用 `handleOpenIntentCanvas` 或 `handleOpenProjectMap`
- **AND** Quick Switcher MUST 关闭
