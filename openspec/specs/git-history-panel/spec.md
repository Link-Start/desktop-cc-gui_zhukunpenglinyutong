# git-history-panel Specification

## Purpose

Defines the git-history-panel behavior contract, covering Four-Region Git Log Workspace.
## Requirements
### Requirement: Panel State Persistence

The system SHALL persist panel UI state to restore user context.

#### Scenario: Restore layout state

- **WHEN** user reopens the panel
- **THEN** the system restores previously saved column widths and split ratio

#### Scenario: Restore navigation state

- **WHEN** user reopens the panel
- **THEN** the system restores selected branch, selected commit, and active filters when still valid

#### Scenario: Persist open or closed state

- **WHEN** user closes and restarts the application
- **THEN** the panel open/closed state SHALL be restored

---

### Requirement: Commit Log Table Structure

The middle column SHALL display commit rows with graph and key metadata columns.

#### Scenario: Commit row rendering

- **WHEN** commit rows are loaded
- **THEN** each row shows:
    - Graph node/edges
    - Subject line
    - Ref labels (branch/tag)
    - Author
    - Relative time

#### Scenario: Truncated subject with full tooltip

- **WHEN** subject exceeds row width
- **THEN** row shows truncated text and full subject on hover tooltip

---

### Requirement: Keyboard Navigation Inside Panel

The system SHALL support keyboard navigation for history browsing.

#### Scenario: Arrow navigation

- **WHEN** user presses `↑` or `↓`
- **THEN** the previous/next commit row becomes selected

#### Scenario: Enter on selected row

- **WHEN** user presses `Enter` on a selected commit
- **THEN** the right column SHALL focus that commit details

#### Scenario: Escape closes panel

- **WHEN** user presses `Escape`
- **THEN** the Git History panel SHALL close

---

### Requirement: Loading, Error and Empty States

The panel SHALL expose clear operational states.

#### Scenario: Loading history

- **WHEN** commit history is being fetched
- **THEN** middle column shows loading indicator

#### Scenario: Backend error

- **WHEN** history fetch fails
- **THEN** middle column shows user-friendly error with `Retry` action

#### Scenario: Empty repository

- **WHEN** repository has no commits
- **THEN** middle column shows "No commits found in this repository"

---

### Requirement: Theme and Visual Consistency

The panel SHALL follow application theme variables and SHALL present its title layer as integrated, non-clipping window chrome.

#### Scenario: Dark theme

- **WHEN** application is in dark mode
- **THEN** panel and diff colors follow dark theme tokens with readable contrast
- **AND** the title layer SHALL use subtle surface separation and a perceptible 1px bottom divider backed by a globally defined theme token
- **AND** it SHALL NOT appear as an inset rounded card

#### Scenario: Light theme

- **WHEN** application is in light mode
- **THEN** panel and diff colors follow light theme tokens with readable contrast
- **AND** the title layer SHALL remain visually distinct without relying on dark-theme-only colors or an ambient card shadow
- **AND** the 1px bottom divider SHALL remain perceptible against the light title surface

#### Scenario: Title layer keeps interactive overlays visible

- **WHEN** user opens a project or repository picker from the title layer
- **THEN** the picker dropdown SHALL remain fully visible outside the title layer
- **AND** the title layer SHALL NOT clip toolbar actions or control focus indicators
- **AND** focusing one control SHALL NOT add a frame around the entire title layer

#### Scenario: Title layer remains stable across panel states and widths

- **WHEN** Git History renders its normal state, repository empty state, or a narrow viewport
- **THEN** the title layer SHALL remain full-width and zero-radius with a consistent integrated chrome treatment
- **AND** existing toolbar wrapping SHALL remain available without introducing horizontal overflow

#### Scenario: Title layer uses compact vertical density

- **WHEN** Git History renders the title layer on a viewport that fits the toolbar in one row
- **THEN** decorative vertical padding SHALL be minimized so the title layer height is primarily determined by its interactive controls
- **AND** project/repository pickers, action chips, and close action SHALL retain their existing control height and pointer target
- **AND** the bottom divider SHALL remain visible without adding a second vertical spacer

### Requirement: Large History Performance Baseline

The commit log SHALL remain usable for large repositories.

#### Scenario: Virtualized rendering

- **WHEN** repository has more than 10,000 commits
- **THEN** the commit list uses virtual scrolling and renders only visible rows plus buffer

#### Scenario: Incremental loading

- **WHEN** user scrolls near list bottom
- **THEN** system loads next page (default 100 commits) without blocking current interactions

### Requirement: Git History worktree commit surface MUST mirror the main git panel commit semantics

Git History/HUB 内的 worktree 提交区 MUST 以右侧主 Git 面板为 canonical surface，保持同一套 commit scope、commit hint、button enablement 与 AI generation 语义。

#### Scenario: worktree surface mirrors main panel commit feedback

- **WHEN** Git History/HUB worktree 提交区与主 Git 面板面对同一组 staged / unstaged / selected changes
- **THEN** 两个 surface 的 commit button enablement MUST 一致
- **AND** 两个 surface 的 hint copy MUST 表达同一 commit scope 状态
- **AND** 空 scope 时两者都 MUST 阻断 commit

#### Scenario: worktree surface mirrors main panel generation menu semantics

- **WHEN** 用户在 Git History/HUB worktree 提交区触发 AI 生成提交信息
- **THEN** 系统 MUST 提供与主 Git 面板一致的 engine selection 与 language selection 入口
- **AND** 生成请求 MUST 基于当前 worktree surface 的 commit scope
- **AND** 生成结果 MUST 与主 Git 面板在相同 scope 下保持语义一致

#### Scenario: worktree surface keeps file tree scope behavior stable across platforms

- **WHEN** Git History/HUB worktree 提交区在 tree 模式下渲染 Windows 风格或 POSIX 风格路径
- **THEN** file row、folder row 与 section row 的 commit scope 判断 MUST 基于 normalized path contract
- **AND** 用户在不同平台下对同一文件集合执行 inclusion toggle 时 MUST 得到相同结果

### Requirement: Push Dialog Before Execution

The Git History toolbar SHALL open a push configuration dialog before executing push.

#### Scenario: Open push dialog

- **WHEN** user clicks toolbar `Push`
- **THEN** system SHALL open a push dialog
- **AND** system SHALL NOT execute push immediately

#### Scenario: Configure push target

- **WHEN** push dialog is open
- **THEN** dialog SHALL display current local branch as readonly value
- **AND** user SHALL be able to configure `remote` and `target remote branch`
- **AND** target remote branch SHALL support both dropdown selection and manual input
- **AND** dialog SHALL show target summary in `sourceBranch -> remote:targetBranch` form
- **AND** when `Push to Gerrit` is enabled, target summary SHALL switch to `sourceBranch -> remote:refs/for/targetBranch`

#### Scenario: Remote dropdown opens upward in push dialog

- **WHEN** user opens remote selector in push dialog
- **THEN** remote dropdown menu SHALL expand upward to avoid overlapping footer operation controls

#### Scenario: Show outgoing commits preview

- **WHEN** push dialog is open
- **THEN** system SHALL display `outgoing commits` list for current push target
- **AND** each list item SHALL include commit summary metadata (subject, sha, author, time)

#### Scenario: Preview panes keep fixed viewport with internal scrolling

- **WHEN** outgoing commit list or changed file list exceeds visible height
- **THEN** preview panes SHALL keep fixed height
- **AND** commit list and file list SHALL provide internal scrollbars instead of stretching dialog layout

#### Scenario: Target remote branch missing enters new-branch first-push mode

- **WHEN** preview result indicates target remote branch ref is missing (`targetFound=false`)
- **THEN** dialog SHALL show `New` marker in target summary area
- **AND** dialog SHALL keep preview section layout stable with first-push guidance placeholder
- **AND** dialog SHALL NOT render outgoing commit list items and selected commit detail content for that state

#### Scenario: Show selected commit file tree and details

- **WHEN** user selects a commit from outgoing list
- **THEN** system SHALL display changed files for that commit
- **AND** system SHALL display commit detail summary (message, sha, author, time)

#### Scenario: Open preview file diff by explicit file click

- **WHEN** selected commit details are visible in push preview
- **AND** user clicks one changed file row
- **THEN** system SHALL open a popup diff modal for that file
- **AND** selecting commit items alone SHALL NOT auto-open diff modal

#### Scenario: Refresh preview when push target changes

- **WHEN** user changes `remote` or `target remote branch`
- **THEN** system SHALL recompute outgoing commit preview
- **AND** list/detail panes SHALL update to new target context (or switch to new-branch first-push placeholder state
  when `targetFound=false`)

#### Scenario: Empty preview state blocks accidental push

- **WHEN** no outgoing commits exist for current push target
- **THEN** dialog SHALL show explicit empty state
- **AND** confirm push action SHALL be disabled

#### Scenario: Toggle Gerrit mode

- **WHEN** user enables `Push to Gerrit`
- **THEN** dialog SHALL reveal `Topic`, `Reviewers`, `CC` fields
- **AND** disabling Gerrit mode SHALL hide those fields

#### Scenario: Close dialog without side effects

- **WHEN** user cancels dialog or presses `Escape`
- **THEN** dialog closes
- **AND** no push command SHALL be sent

### Requirement: Commit Action Button Group

The commit history workspace SHALL provide a linked commit action button group that mirrors key commit-row context
actions.

#### Scenario: Button group actions

- **WHEN** Git History panel is open and a commit is selected
- **THEN** commit action button group SHALL expose:
    - `Copy Revision Number`
    - `Create Branch from Commit`
    - `Reset Current Branch to Here...`

#### Scenario: Selection-driven availability

- **WHEN** no commit is selected
- **THEN** commit action button group SHALL be disabled
- **AND** no action SHALL execute

#### Scenario: Shared availability with context menu

- **WHEN** repository enters busy write-operation state
- **THEN** `Reset Current Branch to Here...` SHALL be disabled in button group
- **AND** the same action SHALL be disabled in commit-row context menu

### Requirement: Pull Dialog Before Execution

The Git History toolbar SHALL open a pull configuration dialog before executing pull.

#### Scenario: Open pull dialog

- **WHEN** user clicks toolbar `Pull`
- **THEN** system SHALL open a pull dialog
- **AND** system SHALL NOT execute pull immediately

#### Scenario: Configure pull target and options

- **WHEN** pull dialog is open
- **THEN** dialog SHALL allow configuring `remote` and `target remote branch`
- **AND** target remote branch SHALL support both dropdown selection and manual input
- **AND** dialog SHALL allow selecting pull options and render selected options as removable chips

#### Scenario: Disable conflicting strategy options

- **WHEN** one strategy option among `--rebase`, `--ff-only`, `--no-ff`, `--squash` is selected
- **THEN** conflicting strategy options SHALL be disabled in options menu
- **AND** additive options (`--no-commit`, `--no-verify`) SHALL remain selectable when valid

#### Scenario: Show pull intent details and example

- **WHEN** pull dialog is open
- **THEN** dialog SHALL display `Intent`, `Will Happen`, `Will NOT Happen`, and `Example` sections
- **AND** `Example` SHALL reflect current pull target/options state

#### Scenario: Pull toolbar and dialog title icon consistency

- **WHEN** pull action is rendered in toolbar and pull dialog title
- **THEN** system SHALL show pull icon in both locations
- **AND** icon mapping SHALL stay visually consistent for the same action

#### Scenario: Confirm pull from dialog

- **WHEN** user confirms pull in dialog
- **THEN** dialog SHALL submit configured options to pull operation
- **AND** dialog SHALL enter in-progress state and disable duplicate submission

#### Scenario: Close pull dialog without side effects

- **WHEN** user cancels pull dialog or presses `Escape`
- **THEN** dialog closes
- **AND** no pull command SHALL be sent

### Requirement: Sync, Fetch, and Refresh Dialogs Before Execution

The Git History toolbar SHALL require confirmation dialogs for `Sync`, `Fetch`, and `Refresh` actions before execution.

#### Scenario: Open sync dialog

- **WHEN** user clicks toolbar `Sync`
- **THEN** system SHALL open a sync confirmation dialog
- **AND** system SHALL NOT execute sync immediately

#### Scenario: Open fetch dialog

- **WHEN** user clicks toolbar `Fetch`
- **THEN** system SHALL open a fetch confirmation dialog
- **AND** system SHALL NOT execute fetch immediately

#### Scenario: Open refresh dialog

- **WHEN** user clicks toolbar `Refresh`
- **THEN** system SHALL open a refresh confirmation dialog
- **AND** system SHALL NOT execute refresh immediately

#### Scenario: Dialogs provide detailed intent and examples

- **WHEN** sync/fetch/refresh dialog is open
- **THEN** dialog SHALL display `Intent`, `Will Happen`, `Will NOT Happen`, and `Example` sections
- **AND** sync dialog example SHALL describe `pull -> push` sequence
- **AND** sync dialog SHALL display preflight summary (`source -> remote:target`, ahead/behind, outgoing sample)
- **AND** fetch dialog example SHALL describe fetch-only behavior without merge
- **AND** fetch dialog SHALL show fetch scope (default `all remotes`)
- **AND** refresh dialog example SHALL describe UI data reload behavior without Git network commands

#### Scenario: Distinct icons for sync/fetch/refresh semantics

- **WHEN** toolbar and dialog titles render sync/fetch/refresh actions
- **THEN** each action SHALL use its own icon mapping
- **AND** fetch and refresh SHALL NOT reuse the same icon

#### Scenario: Dialog visual hierarchy for readability

- **WHEN** any sync/fetch/refresh confirmation dialog is open
- **THEN** dialog SHALL present a three-zone layout: header, intent details, footer actions
- **AND** key risk/impact message SHALL remain visually distinguishable from secondary text

#### Scenario: Confirm sync/fetch/refresh from dialog

- **WHEN** user confirms sync/fetch/refresh dialog
- **THEN** system SHALL execute the corresponding action once
- **AND** dialog SHALL enter in-progress state and disable duplicate submission

#### Scenario: Close sync/fetch/refresh dialog without side effects

- **WHEN** user cancels sync/fetch/refresh dialog or presses `Escape`
- **THEN** dialog closes
- **AND** no corresponding action SHALL be sent

### Requirement: Operation Error Notice Persistence and Manual Dismiss

The Git History panel SHALL keep operation error notice visible until user explicitly dismisses it or a new operation
replaces it.

#### Scenario: Error notice does not auto-dismiss

- **WHEN** a toolbar or context Git operation fails
- **THEN** panel SHALL show error notice in error style
- **AND** notice SHALL NOT auto-dismiss after fixed 5-second timeout

#### Scenario: User manually dismisses error notice

- **WHEN** error notice is visible
- **THEN** panel SHALL provide explicit close control
- **AND** clicking close SHALL clear current error notice immediately

#### Scenario: Success notice remains short-lived

- **WHEN** a Git operation succeeds
- **THEN** panel MAY auto-dismiss success notice after short timeout
- **AND** success notice lifecycle SHALL NOT force error notice auto-dismiss behavior

### Requirement: PR Entry in Git Toolbar

The Git History toolbar SHALL expose a `PR` entry in the top action area before pull/push/sync actions.

#### Scenario: Toolbar action order remains stable

- **WHEN** Git History panel is rendered
- **THEN** toolbar SHALL render `PR` action in the designated action group
- **AND** existing pull/push/sync/fetch/refresh actions SHALL keep their functional order

#### Scenario: PR action disabled reason

- **WHEN** current branch context is unavailable
- **THEN** `PR` action SHALL be disabled
- **AND** UI SHALL provide a readable disabled reason

### Requirement: Create PR Dialog with Compare Bar

The panel SHALL provide a dedicated Create PR dialog with compare-style repository/branch parameter controls.

#### Scenario: Open dialog with prefilled defaults

- **WHEN** user clicks `PR`
- **THEN** dialog SHALL request workflow defaults and prefill upstream/base/head/title/body/comment fields
- **AND** user SHALL be able to edit title/body/comment before execution

#### Scenario: Compare controls are searchable selectors

- **WHEN** dialog is open
- **THEN** `base repository / base / head repository / compare` fields SHALL support searchable dropdown selection
- **AND** selected values SHALL be clearly visible with overflow-safe presentation

### Requirement: Staged Progress and Result Actions

The dialog SHALL show workflow progress by stages and expose actionable result operations.

#### Scenario: Stage progress mapping

- **WHEN** workflow starts
- **THEN** UI SHALL render stages `precheck/push/create/comment`
- **AND** each stage SHALL reflect backend status (`pending/running/success/failed/skipped`)

#### Scenario: Actionable result state

- **WHEN** workflow completes
- **THEN** success or existing PR state SHALL offer `open/copy PR link`
- **AND** failure state SHALL expose next-action hint and retry command copy when available

### Requirement: Git History Panel Modularization Parity
The system SHALL preserve existing Git History panel behavior while internal modules are extracted from oversized files.

#### Scenario: Core interaction parity after module split
- **WHEN** `GitHistoryPanel` internal logic is split into submodules
- **THEN** panel open/close, branch selection, commit selection, and commit detail rendering MUST remain behavior-equivalent
- **AND** no user workflow change SHALL be required

### Requirement: Git History Action and Context Menu Parity
The system SHALL preserve branch/commit context actions during and after modularization.

#### Scenario: Context actions remain reachable
- **WHEN** user opens branch or commit context menus after refactor
- **THEN** action entries and execution semantics MUST match pre-refactor behavior
- **AND** disabled/loading/error states MUST remain consistent with current expectations

### Requirement: Git History Style Modularization Safety
The system SHALL preserve visual semantics when large panel styles are split into feature-scoped style modules.

#### Scenario: Visual consistency after style split
- **WHEN** Git History related styles are modularized
- **THEN** four-region layout structure, split areas, and critical interaction affordances MUST remain visually consistent
- **AND** no clipping or overlap regressions SHALL be introduced in standard viewport sizes

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

### Requirement: Three-Column Git Log Workspace

The system SHALL provide a three-column Git History workspace focused on branch navigation, commit browsing, and commit details.

#### Scenario: Open panel from sidebar

- **WHEN** user clicks the Git History icon in the left sidebar rail
- **THEN** the system opens a three-column panel:
    - Left: branch list
    - Center: commit log with graph
    - Right: commit details (file list + commit message)
- **AND** the panel MUST NOT visually expose the former overview/worktree region or include it in the accessibility tree
- **AND** the three columns SHALL occupy the full available workbench width
- **AND** hiding the region MUST NOT reset the toolbar worktree summary while its status source remains available

#### Scenario: Right column split layout

- **WHEN** the panel is open
- **THEN** the right column SHALL be split vertically into:
    - Top: changed files list
    - Bottom: selected commit message

#### Scenario: Desktop columns use a three-four-three default ratio

- **WHEN** Git History opens in desktop split layout
- **THEN** the system SHALL subtract the two visible vertical separators from the available width
- **AND** branch, commit, and details columns SHALL receive the remaining width in a `3:4:3` default ratio
- **AND** users SHALL retain the existing ability to resize the columns

#### Scenario: Click file to preview diff in modal

- **WHEN** user clicks a file item in changed files list
- **THEN** the system opens a modal diff preview for that file
- **AND** commit details main layout SHALL remain unchanged

### Requirement: Git History changed files tree compacts safe directory chains

The Git History selected-commit changed files tree and Push Preview changed files tree SHALL render consecutive directories as one dot-separated compact folder row only while every traversed directory has no direct files and exactly one child directory. The system MUST preserve repository-root visibility, canonical path identity, expansion behavior, file status, diff statistics, selection, and file-diff opening behavior.

#### Scenario: Single-child package path is compacted

- **WHEN** a changed file is located under a consecutive directory chain with no direct files or sibling directories
- **THEN** the tree SHALL render that chain as one dot-separated folder row
- **AND** the row SHALL use the deepest directory path as its canonical expansion identity

#### Scenario: Directory branch stops compaction

- **WHEN** a directory has two or more child directories
- **THEN** the tree SHALL keep that directory as the current compact boundary
- **AND** each child chain MAY compact independently below that boundary

#### Scenario: Direct file stops compaction

- **WHEN** a directory contains a direct changed file and one child directory
- **THEN** the tree SHALL NOT compact across that directory boundary
- **AND** the direct file and child directory SHALL remain visible at the correct hierarchy level

#### Scenario: Repository root remains explicit

- **WHEN** a repository label is available for the selected Git History scope
- **THEN** the tree SHALL render the repository root as its own folder row
- **AND** compact directory projection SHALL begin below that root

#### Scenario: Compatible path identities survive compact labels

- **WHEN** POSIX and Windows-style paths are projected or two real folder paths produce the same dotted display label
- **THEN** path separators SHALL be normalized for hierarchy construction
- **AND** each real folder path SHALL retain a distinct stable row identity

#### Scenario: Existing file interactions remain path-based

- **WHEN** the user expands a compact folder or selects a changed file
- **THEN** folder state SHALL be updated by canonical path
- **AND** file selection and diff opening SHALL continue targeting the original changed-file path

### Requirement: Pull option explanations track current selection

The Git History Pull Dialog SHALL dynamically explain the effect of the currently selected Pull options without
changing option selection or execution behavior.

#### Scenario: Explain default pull behavior

- **WHEN** Pull Dialog is open without an explicit strategy or additive option
- **THEN** the details area SHALL explain that remote changes are fetched and integration follows applicable Git configuration
- **AND** the details area SHALL NOT promise a specific merge or rebase result

#### Scenario: Explain one selected strategy

- **WHEN** user selects one of `--rebase`, `--ff-only`, `--no-ff`, or `--squash`
- **THEN** `Intent`, `Will Happen`, and `Will NOT Happen` SHALL update from the current selection
- **AND** the explanation SHALL describe history shape, commit behavior, and relevant failure or manual-follow-up behavior
- **AND** `--no-ff` and `--squash` SHALL be described as merge-path effects that do not by themselves
  override an applicable Git rebase configuration

#### Scenario: Explain additive options in strategy context

- **WHEN** user selects `--no-commit` or `--no-verify`
- **THEN** the details area SHALL explain the option in the context of the currently selected strategy
- **AND** merge-only, redundant, or no-additional-effect combinations SHALL be stated explicitly

#### Scenario: Explain representative combined selections

- **WHEN** user selects a combination such as `--no-ff --no-commit`, `--ff-only --no-commit`,
  `--squash --no-commit`, or `--rebase --no-commit --no-verify`
- **THEN** the details area SHALL describe the combined outcome rather than concatenate context-free definitions
- **AND** selected chips and command preview SHALL continue to show the original option combination

#### Scenario: Keep explanation synchronized after removal

- **WHEN** user deselects an option or removes a selected option chip
- **THEN** the details area and command preview SHALL immediately reflect the remaining selection
- **AND** no Pull command SHALL execute before confirmation

#### Scenario: Preserve pull execution behavior

- **WHEN** dynamic Pull explanations are rendered
- **THEN** option availability, selection state, request payload, Git argument ordering, confirmation, and execution SHALL remain unchanged

### Requirement: Pull options and final command are visually discoverable

The Git History Pull Dialog SHALL expose modification options and visually distinguish the final command without
changing option or execution semantics.

#### Scenario: Show modification options when the dialog opens

- **WHEN** user opens the Pull Dialog
- **THEN** all Pull option controls SHALL be visible without an additional click
- **AND** the existing toggle SHALL continue to allow manual collapse and expansion

#### Scenario: Color command tokens without changing the command

- **WHEN** the Pull command preview or `Example` is rendered
- **THEN** command, remote, target branch, and selected options SHALL have visually distinguishable token styling
- **AND** both surfaces SHALL expose the same complete, naturally readable command string and option ordering as before
- **AND** technical command tokens SHALL opt out of automatic translation without assigning a prohibited
  accessible name to `code` or generic elements

#### Scenario: Announce dynamic option effects

- **WHEN** the selected Pull option combination changes
- **THEN** the current effect summary SHALL be exposed as a polite atomic status update
- **AND** the visible `Intent`, `Will Happen`, and `Will NOT Happen` structure SHALL remain unchanged

#### Scenario: Color Fetch, Sync, and Push operation surfaces

- **WHEN** Fetch, Sync, or Push dialog renders a framed command, branch route, ahead/behind summary, or target branch value
- **THEN** command, operator, remote, branch, option, and summary roles SHALL use the shared Git operation color language
- **AND** the rendered natural text, input value, i18n copy, command ordering, selection state, request payload, and execution behavior SHALL remain unchanged
