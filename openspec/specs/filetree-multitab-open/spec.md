# filetree-multitab-open Specification

## Purpose

Defines the filetree-multitab-open behavior contract, covering 文件树支持多文件并行打开.
## Requirements
### Requirement: 文件树支持多文件并行打开

系统 SHALL 在文件树双击打开行为中支持多文件并行打开，而不是替换当前文件；多文件打开 SHALL 保持后台 Tab 轻量，避免因打开多个文件而触发非活动文件的高成本读取、编译或渲染。

#### Scenario: 打开第二个文件不关闭第一个文件
- **GIVEN** 用户已打开文件 A
- **WHEN** 用户在文件树双击文件 B
- **THEN** 系统 SHALL 保留文件 A 的已打开状态
- **AND** 新增文件 B 到已打开 Tab 列表

#### Scenario: 双击已打开文件时激活而非重复创建
- **GIVEN** 文件 A 已存在于已打开 Tab 列表
- **WHEN** 用户再次双击文件 A
- **THEN** 系统 SHALL 仅切换活动 Tab 到文件 A
- **AND** 不得新增重复 Tab

#### Scenario: 单击文件仅更新选中态
- **WHEN** 用户在文件树单击任意文件节点
- **THEN** 系统 SHALL 仅更新选中态
- **AND** 不得触发文件打开动作

#### Scenario: inactive tabs do not perform high-cost preview work
- **GIVEN** 用户已打开多个文件 Tab
- **WHEN** 其中只有一个 Tab 处于活动状态
- **THEN** 非活动 Tab MAY retain lightweight identity and UI state
- **AND** 非活动 Tab MUST NOT run high-cost file reads, Markdown compilation, syntax highlighting, or preview DOM mounting unless explicitly scheduled as bounded background work

#### Scenario: activating a background tab renders from its own snapshot
- **GIVEN** 用户在多个已打开文件之间切换
- **WHEN** 用户激活一个之前处于后台的 Tab
- **THEN** 文件查看区 SHALL 渲染该 Tab 对应文件的内容
- **AND** 不得显示前一个活动 Tab 的 stale content、stale line markers 或 stale annotation draft

#### Scenario: background render work cannot commit after tab switch
- **GIVEN** 文件 A 有 pending preview highlight、Markdown chunk、external refresh 或其他 deferred render work
- **WHEN** 用户切换到文件 B
- **THEN** 文件 A 的 pending work MUST be cancelled or ignored before commit
- **AND** 文件 B SHALL only consume its own active snapshot and render epoch

### Requirement: 文件 Tab 支持切换与关闭

系统 SHALL 提供标签化切换与关闭能力，且关闭活动标签后焦点行为可预测。

#### Scenario: 切换活动标签

- **WHEN** 用户点击任意已打开文件 Tab
- **THEN** 系统 SHALL 将对应文件设为活动 Tab
- **AND** 文件查看区 SHALL 渲染该文件内容

#### Scenario: 关闭活动标签后的焦点回退

- **GIVEN** 用户关闭当前活动 Tab
- **WHEN** 当前标签右侧存在相邻标签
- **THEN** 系统 SHALL 激活右侧标签
- **AND** 若无右侧标签，SHALL 激活左侧标签

#### Scenario: 关闭最后一个标签

- **GIVEN** 仅剩一个已打开 Tab
- **WHEN** 用户关闭该 Tab
- **THEN** 系统 SHALL 进入文件查看空态
- **AND** 不得触发异常或错误渲染

### Requirement: 兼容现有文件打开路径

系统 SHALL 在新增多 Tab 能力后保持现有文件树打开路径可用，并将打开触发统一为双击。

#### Scenario: 首次从文件树打开文件

- **GIVEN** 当前无已打开文件 Tab
- **WHEN** 用户在文件树中双击任意文件
- **THEN** 系统 SHALL 正常打开该文件并创建第一个 Tab
- **AND** 原有“文件可被快速查看内容”体验 MUST 保持不变

### Requirement: 根节点菜单动作不得破坏多 Tab 打开语义
系统 SHALL 在引入根节点上下文菜单后保持现有多 Tab 打开/激活/关闭语义不变。

#### Scenario: root operation does not clear opened tabs
- **GIVEN** 用户已打开多个文件 Tab
- **WHEN** 用户从根节点上下文菜单执行非打开类动作（例如复制路径、在访达中显示）
- **THEN** 系统 SHALL 保留当前已打开 Tab 列表与活动 Tab
- **AND** 不得触发 Tab 重置或文件查看区空态

#### Scenario: create-from-root keeps existing open contract
- **GIVEN** 用户从根节点上下文菜单执行新建文件动作并创建成功
- **WHEN** 系统按现有行为打开或聚焦该文件
- **THEN** 新文件 SHALL 按既有文件树打开契约加入或激活 Tab
- **AND** 已存在的 Tab MUST 保持不丢失

### Requirement: 文件树选择模型 SHALL 支持多选拖拽前置语义

系统 SHALL 在文件树提供平台兼容的多选语义，以支持单次拖拽携带多路径。

#### Scenario: 平台修饰键切换选择项

- **WHEN** 用户使用 macOS `⌘+Click` 或 Windows `Ctrl+Click` 单击文件树节点
- **THEN** 系统 SHALL 切换该节点的选中状态
- **AND** 已选其他节点 SHALL 保持不变

#### Scenario: Shift 区间选择

- **GIVEN** 用户已有一个锚点选中项
- **WHEN** 用户执行 `Shift+Click` 选择另一个节点
- **THEN** 系统 SHALL 选中锚点与目标之间的连续区间
- **AND** 选中集合 SHALL 可用于后续拖拽

#### Scenario: 从已选集合发起拖拽时携带多路径

- **GIVEN** 用户已在文件树中选中多个节点
- **WHEN** 用户从已选集合中的任一节点发起拖拽
- **THEN** 系统 SHALL 以同一批次携带所有已选路径
- **AND** Composer 接收后 SHALL 按既有引用链路批量插入

#### Scenario: 双击文件夹触发展开与折叠

- **WHEN** 用户在文件树双击文件夹节点
- **THEN** 系统 SHALL 切换该文件夹展开状态
- **AND** 单击文件夹 SHALL 仅更新选中态而不展开

### Requirement: Open file tabs MUST own reusable file sessions

Each open file tab MUST have a reusable file session identity so tab activation can restore document/editor state without treating every switch as a fresh open.

#### Scenario: activating cached tab reuses document snapshot

- **GIVEN** file A and file B are both open
- **AND** file A has a ready clean document snapshot
- **WHEN** the user switches from file B back to file A
- **THEN** the file view MUST reuse file A's valid document snapshot before issuing a full file read
- **AND** the first visible content for file A MUST NOT depend on rebuilding file B state

#### Scenario: dirty background tab keeps draft

- **GIVEN** file A has unsaved local edits
- **WHEN** the user switches to file B and then back to file A
- **THEN** file A MUST restore its unsaved draft
- **AND** the app MUST NOT replace the draft with disk content unless the user explicitly discards or reloads it

#### Scenario: tab close releases session

- **WHEN** the user closes an open file tab after confirming any dirty state
- **THEN** the associated file session MAY be released from memory
- **AND** later opening the same path MAY create a fresh session

### Requirement: Tab activation MUST NOT commit stale work

Asynchronous work scheduled by one tab MUST NOT mutate another tab after activation changes.

#### Scenario: stale preview work cannot update active tab

- **GIVEN** file A has pending Markdown, syntax, git marker, or external refresh work
- **WHEN** the user activates file B before that work completes
- **THEN** file A work MUST verify file identity and render epoch before commit
- **AND** failed verification MUST drop the result without mutating file B's visible state

### Requirement: File tabs MUST be remembered per workspace during the app session

The system SHALL keep open file tab identity and active file scoped to the current workspace while the app session is running.

#### Scenario: switching back restores workspace file tabs

- **GIVEN** workspace A has file A1 and file A2 open
- **AND** file A2 is the active file
- **WHEN** the user switches to workspace B and then back to workspace A
- **THEN** workspace A MUST restore file A1 and file A2 as open tabs
- **AND** workspace A MUST restore file A2 as the active file

#### Scenario: another workspace has independent file tabs

- **GIVEN** workspace A has file A open
- **WHEN** the user switches to workspace B and opens file B
- **THEN** workspace B MUST show only workspace B's file tab state
- **AND** workspace A's open tab memory MUST remain available for later restoration

#### Scenario: closing all tabs clears only the current workspace

- **GIVEN** workspace A and workspace B each have open file tabs
- **WHEN** the user closes all file tabs while workspace A is active
- **THEN** workspace A MUST clear its file tab state
- **AND** workspace B MUST retain its file tab state

### Requirement: 文件树多选 SHALL expose compare action without breaking existing selection semantics

系统 SHALL 在文件树多选文件后提供文件对比入口，并保持现有多选、拖拽、双击打开和多 Tab 打开语义不变。

#### Scenario: context menu preserves selected set for compare
- **GIVEN** 用户已在文件树中选中多个文件
- **WHEN** 用户在已选集合中的任一文件上打开右键菜单
- **THEN** 系统 SHALL 保留当前 selected set
- **AND** 文件对比动作 SHALL 使用该 selected set 中按可见树顺序排列的文件路径

#### Scenario: right-click outside selection resets compare target
- **GIVEN** 用户已在文件树中选中多个文件
- **WHEN** 用户在未选中的另一个文件上打开右键菜单
- **THEN** 系统 SHALL 按现有语义切换为单选
- **AND** 文件对比动作 SHALL 不得误用旧 selected set

#### Scenario: compare action does not open normal editor tabs
- **GIVEN** 用户从文件树右键菜单选择文件对比
- **WHEN** compare surface opens
- **THEN** 系统 SHALL NOT add the selected files to normal editor tab list unless the user separately opens them
- **AND** existing editor tabs SHALL remain unchanged

#### Scenario: multi-file drag remains unchanged
- **GIVEN** 用户已在文件树中选中多个文件
- **WHEN** 用户从选中集合发起拖拽
- **THEN** 系统 SHALL continue carrying the selected paths as a drag batch
- **AND** 新增文件对比动作 SHALL NOT alter drag payload semantics

### Requirement: File tab context menu MUST target the invoked tab

系统 SHALL 为文件 tab 提供目标感知的 context menu，并确保所有动作作用于触发右键的 tab，而不是隐式作用于当前 active tab。

#### Scenario: background tab remains the action target
- **GIVEN** file A is active and file B is also open
- **WHEN** 用户在 file B 上打开 context menu 并选择 `关闭当前`
- **THEN** 系统 MUST 关闭 file B
- **AND** file A MUST 保持 active

#### Scenario: open target tab in detached window
- **GIVEN** 用户在任一已打开 file tab 上打开 context menu
- **WHEN** 用户选择 `在新窗口打开标签`
- **THEN** 系统 MUST 复用 detached file explorer 创建链路打开该目标 path
- **AND** MUST NOT substitute the current active tab path

### Requirement: File tab context menu MUST provide atomic close actions

系统 SHALL 提供 `关闭当前`、`关闭其他` 与 `全部关闭`，并由拥有 tab state 的 controller 原子更新当前 workspace 或 detached session。

#### Scenario: close other tabs keeps and activates the target
- **GIVEN** 当前 session 打开 file A、file B 与 file C
- **WHEN** 用户在 file B 的 context menu 选择 `关闭其他`
- **THEN** open tabs MUST become exactly `[file B]`
- **AND** file B MUST become active

#### Scenario: close other is disabled for a single tab
- **GIVEN** 当前 session 仅打开一个 file tab
- **WHEN** 用户打开该 tab 的 context menu
- **THEN** `关闭其他` MUST be disabled
- **AND** selecting it MUST NOT mutate tab state

#### Scenario: close all remains workspace scoped
- **GIVEN** main window workspace A、workspace B 与 detached explorer 各有 open tabs
- **WHEN** 用户在 workspace A 的 tab context menu 选择 `全部关闭`
- **THEN** only workspace A tab state MUST be cleared
- **AND** workspace B and detached explorer tab state MUST remain unchanged

### Requirement: File tab context menu MUST expose read-only Git actions

系统 SHALL 在 `Git 操作` submenu 中仅提供 `显示文件历史` 与 `Git Blame`，并根据目标文件的 Git scope 与 surface capability 控制可用状态。

#### Scenario: file history uses target repository scope
- **GIVEN** 目标 tab belongs to a resolved Git repository and file history callback is available
- **WHEN** 用户选择 `显示文件历史`
- **THEN** 系统 MUST pass the target workspace、repository root、repository-relative path and display path to the existing file history flow

#### Scenario: Git Blame activates a background target first
- **GIVEN** 用户在非 active text file tab 上打开 context menu
- **WHEN** 用户选择 `Git Blame`
- **THEN** 系统 MUST activate that target tab before enabling blame
- **AND** blame MUST NOT load for the previously active file

#### Scenario: unavailable Git action cannot execute
- **GIVEN** 目标 file lacks a valid Git scope or the current surface cannot open file history
- **WHEN** context menu renders
- **THEN** the unavailable action MUST be disabled or omitted
- **AND** no Git request MUST be issued for that action

### Requirement: File tab context menu MUST follow shared visual and accessibility contracts

菜单 SHALL 复用 shared renderer context menu 的 portal、viewport、dismiss 与 keyboard contract，并为可操作 menu item 提供左侧 icon。

#### Scenario: menu remains inside viewport
- **WHEN** 用户在 viewport 右侧或底部附近打开 file tab context menu
- **THEN** menu position MUST be clamped inside the visible viewport

#### Scenario: menu supports dismissal and focus feedback
- **WHEN** menu is open and the user presses Escape、clicks outside、or the window loses focus
- **THEN** menu MUST close
- **AND** hover/focus state MUST use theme tokens in light and dark themes

#### Scenario: actions expose decorative icons without changing labels
- **WHEN** file tab context menu renders
- **THEN** each actionable root item MUST render a left icon marked decorative
- **AND** accessible menuitem names MUST continue to come from localized labels

### Requirement: File content context menu MUST consolidate editor commands

系统 SHALL 在文件内容区提供与 file tab context menu 同视觉契约的单一 context menu，并将 note capture、clipboard commands、read-only Git actions 与原 file toolbar commands 收敛到该入口。

#### Scenario: edit surface exposes capture, clipboard and file commands
- **GIVEN** active file is editable and rendered in edit mode
- **WHEN** 用户在 CodeMirror 内容区打开 context menu
- **THEN** exactly one renderer context menu MUST open
- **AND** menu MUST include available note capture、`剪切`、`复制`、`粘贴`
- **AND** menu MUST expose available Intent Canvas、definition、references、preview and save commands
- **AND** `显示文件历史` 与 Git Blame MUST be grouped under `Git 操作`

#### Scenario: preview surface keeps safe command boundaries
- **GIVEN** active file is rendered in preview or read-only mode
- **WHEN** 用户打开 file content context menu
- **THEN** Copy MUST be available only when text is selected
- **AND** Cut and Paste MUST be disabled
- **AND** available note capture and read-only File History MAY remain available
- **AND** unavailable editor-only commands MUST NOT execute

#### Scenario: clipboard failure preserves editor content
- **GIVEN** Clipboard API is unavailable or rejects access
- **WHEN** 用户选择 Cut、Copy or Paste
- **THEN** system MUST surface an explicit error
- **AND** failed Cut MUST NOT delete the selected editor content

#### Scenario: independent editable controls retain native menu
- **GIVEN** file view contains an annotation input、textarea or non-CodeMirror contenteditable control
- **WHEN** 用户在该 control 上打开 context menu
- **THEN** system MUST NOT replace its native context menu with the file content menu

### Requirement: File content note capture MUST prefer canonical selection and fall back to the complete file

系统 SHALL 在同一 file content context menu 内生成 source-aware `NoteCaptureDraft`；canonical code selection 优先，无 selection 时使用当前完整文本文件，并继续由 note workbench 确认保存。

#### Scenario: edit selection capture preserves current range
- **GIVEN** CodeMirror has a non-empty canonical selection
- **WHEN** 用户打开 file content context menu 并选择保存到便签
- **THEN** draft MUST contain exactly the selected document text and source line range
- **AND** no second note-only popover MUST render

#### Scenario: edit without selection captures the current whole document
- **GIVEN** CodeMirror has no non-empty selection and the loaded text document is not truncated or blank
- **WHEN** 用户选择保存到便签
- **THEN** draft MUST contain the current complete CodeMirror document from line 1 through its final line
- **AND** unsaved editor changes MUST be included

#### Scenario: preview selection and whole-source fallback remain source-aware
- **GIVEN** a code preview has a logical line selection
- **WHEN** 用户选择保存到便签
- **THEN** draft MUST contain that frozen logical line range
- **WHEN** the same preview has no logical line selection
- **THEN** draft MUST contain the complete loaded source

#### Scenario: incomplete or unsupported content is not captured as a whole file
- **GIVEN** the file is truncated、blank or has no canonical text source
- **WHEN** file content context menu renders without a valid selection draft
- **THEN** system MUST NOT offer an action that labels partial or unavailable content as the complete file

### Requirement: File content Git actions MUST use one repository-scoped submenu

系统 SHALL 为 active file content menu 复用 `Git 操作` submenu，并 SHALL 以 owning repository scope 执行 `显示文件历史` 与 Git Blame。

#### Scenario: nested repository history targets the active file
- **GIVEN** active file belongs to a nested known Git repository and File History navigation is available
- **WHEN** 用户选择 `Git 操作 -> 显示文件历史`
- **THEN** callback MUST receive the owning repository root、repository-relative path and active display path

#### Scenario: Git submenu exposes only available read-only actions
- **WHEN** active file has no valid Git scope or a host capability is absent
- **THEN** the corresponding Git leaf MUST be omitted or disabled
- **AND** no Git mutation action MUST be introduced

### Requirement: File view header MUST keep navigation and tabs on one row

系统 SHALL 将 file back/leading action 放在 Tab 行最左侧，并 SHALL NOT render the legacy path/action toolbar below the Tab row。

#### Scenario: main file view uses one header row
- **WHEN** main window renders an active file with one or more tabs
- **THEN** back action MUST appear before the tab list in the same row
- **AND** the legacy `.fvp-topbar` MUST NOT be rendered

#### Scenario: detached file view preserves leading action compatibility
- **WHEN** detached file explorer renders its file header
- **THEN** configured leading direction、label and callback MUST remain effective
- **AND** file commands MUST remain available through the file content context menu instead of a persistent toolbar

### Requirement: File content context menu MUST reuse shared menu behavior

文件内容菜单 SHALL 复用 `RendererContextMenu` 的 portal、viewport clamp、dismiss、keyboard、icon 与 theme contract，不得复制平行 menu implementation。

#### Scenario: content menu follows tab menu visual contract
- **WHEN** file content context menu renders
- **THEN** root menu and actionable items MUST use the same scoped radius、spacing and theme-token treatment as the file tab context menu
- **AND** accessible menuitem names MUST come from localized labels

#### Scenario: content menu remains inside viewport
- **WHEN** 用户在 viewport 右侧或底部附近打开 file content context menu
- **THEN** menu position MUST be clamped inside the visible viewport
- **AND** Escape、outside click or window blur MUST close it

### Requirement: File content context menu MUST reveal the active file in the workspace tree

The file content context menu MUST provide a localized action that reveals the active file in the current workspace file tree without mutating editor or filesystem state.

#### Scenario: Reveal a deeply nested active file

- **GIVEN** the active file is nested below one or more collapsed directories
- **WHEN** the user selects `定位到文件` from the file content context menu
- **THEN** the system MUST switch the right panel to the Files surface when needed
- **AND** MUST expand every ancestor directory of the active file
- **AND** MUST make the active file the primary single selection
- **AND** MUST scroll the target file row into the nearest visible tree position

#### Scenario: Reveal through progressively loaded directories

- **GIVEN** the active file has any filename or extension and one or more ancestor directories are not yet present in the current lazy tree snapshot
- **WHEN** the user selects `定位到文件` once
- **THEN** the system MUST progressively load and expand each available ancestor using the same reveal request
- **AND** MUST reach, select, and scroll to the target without requiring another user action

#### Scenario: Repeat reveal for the same active file

- **GIVEN** the active file is already selected and visible in the file tree
- **WHEN** the user selects `定位到文件` again
- **THEN** the system MUST process a new reveal request
- **AND** MUST scroll the target row again without changing open tabs or active editor state

#### Scenario: Reveal does not mutate file or editor state

- **WHEN** a file reveal action completes
- **THEN** open tabs, active file, editor buffer, dirty state, and filesystem contents MUST remain unchanged
- **AND** the action MUST NOT invoke the operating-system Finder or Explorer reveal flow
