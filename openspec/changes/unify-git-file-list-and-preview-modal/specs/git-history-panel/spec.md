## ADDED Requirements

### Requirement: Git History file surfaces reuse the canonical changed-file renderer
`GitHistoryWorktreePanel` 与 `GitHistoryPanelView` commit details MUST 复用 Git canonical changed-file renderer，而不是分别维护 file/folder row implementations。

#### Scenario: Full Git worktree list switches view mode
- **WHEN** 用户在 Git History worktree 区域切换 flat/tree mode
- **THEN** shared renderer MUST preserve section、folder collapse、selection 与 mutation actions

#### Scenario: Commit file activation opens preview command
- **WHEN** 用户通过 mouse 或 keyboard 激活 commit details file row
- **THEN** shared renderer MUST 向容器发出同一个 preview command

### Requirement: Git History commit preview reuses the canonical modal chrome
`GitHistoryPanelView` 的 commit file preview MUST 复用 canonical preview 的单行 header controls contract，不能在 shared review surface 外继续显示 legacy title/close toolbar。

#### Scenario: Commit preview opens from the right changed-file tree
- **WHEN** 用户点击 Git History 右侧 commit changed-file tree 中的文件
- **THEN** Diff controls、maximize 与唯一 close action MUST 位于 modal 顶部同一行
- **AND** modal MUST NOT 显示额外的“打开弹窗预览差异”或只读路径说明区
- **AND** read-only commit patch MUST 使用 aligned compare renderer，不得回退到 legacy green/red `GitDiffViewer` body

#### Scenario: Working-tree preview opens from the left changed-file list
- **WHEN** 用户点击 Git History 左侧 working-tree changed-file list 中的文件
- **THEN** editable Diff controls、maximize 与唯一 close action MUST 位于 modal 顶部同一行
- **AND** modal MUST NOT 显示额外的“可编辑差异”与文件路径说明区

### Requirement: Read-only commit preview renders full file context
Git History commit preview 的 aligned read-only compare MUST 使用既有按需 `fullDiffLoader` 获取 full-context patch，不能只渲染 commit details 中的截断 patch hunks。

#### Scenario: Full-context patch loads successfully
- **WHEN** read-only commit preview 打开 text file 且 full-context request 成功
- **THEN** previous/source 两列 MUST 包含未变更区段与差异区段
- **AND** difference navigation MUST 基于 full-context sources 计算

#### Scenario: Full-context request fails or becomes stale
- **WHEN** request 失败，或用户在 request 返回前切换文件
- **THEN** renderer MUST 保留当前文件的 initial patch fallback
- **AND** stale response MUST NOT 覆盖新文件内容

#### Scenario: User switches between region and full-file modes
- **WHEN** 用户在 read-only split Diff 中切换“区域查看”与“全文查看”
- **THEN** 两种模式 MUST 使用同一个 aligned compare renderer 与视觉规则
- **AND** editable file 的区域模式 MUST 保留完整 document draft 与编辑能力，仅折叠 unchanged ranges
- **AND** read-only commit file 的区域模式 MUST 使用 initial patch scope
- **AND** 全文模式 MUST 使用完整 document 或 loaded full-context patch scope

#### Scenario: Read-only commit preview uses region mode
- **WHEN** Git History commit file preview 为 read-only 且用户选择“区域查看”
- **THEN** modal MUST 使用 legacy `GitDiffViewer` patch body
- **AND** MUST NOT 显示 aligned compare 的双列只读 document body
- **AND** toolbar MUST 隐藏“全文查看”control，只保留“区域查看”
- **AND** preview MUST NOT 请求 full-context Diff
