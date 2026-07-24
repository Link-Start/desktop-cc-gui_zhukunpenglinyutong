# File History View Specification

## Purpose

Defines repository-scoped file history behavior, including independent UI, rename identity, adaptive read-only diff rendering, stale-response protection, and Desktop/daemon parity.
## Requirements
### Requirement: File tree exposes repository-scoped file history

The system SHALL expose `Git -> 显示历史记录` for a file when the file belongs to a discovered Git repository and the host surface can open File History.

#### Scenario: Open root repository file history
- **WHEN** user opens the Git submenu for a file in the workspace root repository and selects `显示历史记录`
- **THEN** the system opens File History with the workspace id, `repositoryRoot=""`, and normalized repository-relative file path

#### Scenario: Open nested repository file history
- **WHEN** a workspace file belongs to one of multiple nested repositories
- **THEN** the system MUST choose the longest matching repository root
- **AND** MUST remove that repository prefix before querying history

#### Scenario: Unsupported host does not expose a dead entry
- **WHEN** FileTree is rendered without an `onOpenFileHistory` capability or the file does not belong to a discovered repository
- **THEN** the File History menu item MUST NOT be shown

### Requirement: Independent file history workspace

The system SHALL render each File History target as an independent document tab inside the Git Graph workspace, with a commit list and a selected-commit file diff, without modifying Git Graph branch/commit behavior.

#### Scenario: First history page loads
- **WHEN** File History tab opens for a valid tracked file
- **THEN** the system SHALL request the first 100 path-scoped commits
- **AND** the list SHALL show commit summary, author, time, and short SHA
- **AND** the first commit SHALL become selected after the first successful load

#### Scenario: Selected commit displays only the target file diff
- **WHEN** user selects a commit in File History
- **THEN** the system SHALL request `get_git_commit_diff` with the selected SHA, exact repository-relative path, and repository root
- **AND** SHALL render the returned text diff with the shared read-only aligned compare
- **AND** SHALL label the two synchronized CodeMirror panes as previous version and source code

#### Scenario: Pre-rename commit uses its historical path
- **WHEN** user selects a commit that touched the file before a rename
- **THEN** the system SHALL request the diff with that commit's repository-relative historical path
- **AND** SHALL NOT fall back to an unrelated file from the same commit

#### Scenario: Read-only compare preserves diff decorations
- **WHEN** a selected text diff is rendered in File History
- **THEN** both panes SHALL use CodeMirror with editing disabled
- **AND** previous-version changed lines SHALL use deletion styling
- **AND** source-code changed lines SHALL use addition styling
- **AND** difference navigation SHALL scroll the read-only editors
- **AND** ordinary read-only state MUST NOT downgrade either pane to plain text

#### Scenario: Read-only compare preserves source line numbers
- **WHEN** a unified patch hunk starts below line 1 or contains multiple separated hunks
- **THEN** previous and source CodeMirror gutters SHALL display the parsed old/new source line numbers
- **AND** separator rows without a source coordinate SHALL render without a fabricated line number

#### Scenario: Plain-text fallback remains exceptional
- **WHEN** a compare column is unsupported, truncated, or has a rendering error
- **THEN** the system MAY use the existing plain-text/error fallback
- **AND** MUST NOT confuse that fallback with normal read-only rendering

#### Scenario: History continues incrementally
- **WHEN** user reaches the end of a page and the response indicates `hasMore=true`
- **THEN** the system SHALL request the next page using the same snapshot id and path scope
- **AND** SHALL append unique commits without blocking the current diff

### Requirement: File history operational states are explicit

The File History view MUST expose loading, error, retry, empty, binary/image, and tab-close behavior without initiating Git mutations.

#### Scenario: Binary and image commits are explicit
- **WHEN** the selected path is a non-image binary
- **THEN** the view SHALL show an explicit binary-file state
- **WHEN** the selected path is an image in Desktop local or remote daemon mode
- **THEN** the backend SHALL return equivalent image metadata and old/new payloads
- **AND** the view SHALL use the shared image diff renderer

#### Scenario: File has no history
- **WHEN** backend returns an empty commit page
- **THEN** the view SHALL show a file-scoped no-history state
- **AND** SHALL NOT fall back to repository-wide commits

#### Scenario: History request fails
- **WHEN** path-scoped history loading fails
- **THEN** the commit list SHALL show a user-readable error and Retry action
- **AND** existing selected diff content MUST NOT be replaced by unrelated data

#### Scenario: Diff request fails
- **WHEN** selected commit diff loading fails
- **THEN** the diff pane SHALL show a scoped error and Retry action
- **AND** the commit list SHALL remain interactive

#### Scenario: Close file history tab
- **WHEN** user invokes a File History tab close action
- **THEN** the system SHALL remove only that file history target
- **AND** SHALL activate the right adjacent tab, otherwise the left adjacent tab, otherwise the pinned Git Graph tab
- **AND** SHALL NOT execute checkout, revert, reset, or write commands

### Requirement: File and commit switches reject stale responses

The File History view MUST bind history and diff responses to the active file target and selected commit generation.

#### Scenario: File target changes during history loading
- **WHEN** file A history is pending and user opens file B history
- **THEN** a late file A response MUST NOT change file B commits, selection, error, or diff state

#### Scenario: Commit selection changes during diff loading
- **WHEN** commit A diff is pending and user selects commit B
- **THEN** a late commit A response MUST NOT replace commit B diff or error state

### Requirement: File history keeps rendering work bounded

The system SHALL keep large file histories responsive by separating metadata pagination from diff loading.

#### Scenario: Large history list is rendered
- **WHEN** a file has thousands of historical commits
- **THEN** the commit list SHALL use virtualized rendering and bounded page requests
- **AND** SHALL NOT preload diff payloads for unselected commits

### Requirement: File history adapts to its host container

The File History workspace MUST consume the available center surface width without sizing itself from the global viewport.

#### Scenario: Wide container distributes remaining width to diff
- **WHEN** File History has enough inline space for a commit rail and two-pane compare
- **THEN** the commit rail SHALL remain within bounded minimum and maximum widths
- **AND** the diff workspace SHALL fill all remaining width
- **AND** the two compare panes SHALL share that width without a fixed column minimum

#### Scenario: Narrow container preserves readable compare width
- **WHEN** the File History container crosses its narrow layout threshold
- **THEN** the commit list SHALL stack above the diff workspace
- **AND** the diff workspace SHALL use the full container width
- **AND** long source lines SHALL scroll inside their editor pane instead of expanding the workspace

### Requirement: Git Diff Changed-File Rows Expose Repository-Scoped File History

The File History capability SHALL accept navigation from Git Diff changed-file rows in single-repository and multi-repository modes through the existing `FileHistoryTarget` contract. This entry SHALL reuse Git Graph-hosted File History tabs and existing path-scoped history/diff commands.

#### Scenario: Git Diff opens a Git Graph file history tab

- **WHEN** a valid Git Diff row activates `Git -> 显示文件历史`
- **THEN** the host SHALL open the Git Graph panel and activate the clicked file's `FileHistoryTarget` tab
- **AND** it SHALL NOT create a second history renderer or issue a Git mutation.

#### Scenario: Git Diff entry preserves target path domains

- **WHEN** the clicked row belongs to a nested repository
- **THEN** `repositoryRoot` and `displayPath` SHALL be workspace-relative
- **AND** `path` SHALL be repository-relative
- **AND** the existing File History query SHALL receive the exact `repositoryRoot + path`.

#### Scenario: Unsupported Git Diff host omits File History

- **WHEN** Git Diff is rendered without `onOpenFileHistory` or without a valid workspace/repository target
- **THEN** the File History action MUST NOT be shown
- **AND** the existing File History tab state MUST remain unchanged.

### Requirement: File History Workbench 区域可拖拽 & 右侧 Diff 支持横向滚动

File History 下面面板 MUST 由 commit rail / previous version column / source version column 三个区域构成，区域宽度 MUST 可由用户拖拽调整；右侧 compare diff 区域 MUST 支持横向滚动以阅读超长行。

The File History lower panel layout was previously a fixed two-column grid with
a non-resizable commit rail and a 1:1 fixed compare split, leaving no way to
give either side more space; long lines were clipped because the compare
columns container used `overflow: hidden`. The contract MUST require the workbench
to expose two draggable separators and let the diff area scroll horizontally.

#### Scenario: 拖拽 commit↔diff 纵向手柄调整 commit rail 宽度

- **WHEN** 用户在 commit rail 与 diff 之间的高 8px 拖拽手柄上 mousedown 并水平 mousemove
- **THEN** commit rail 宽度 MUST 在 [200px, 60% of container] 区间内连续变化
- **AND** diff 区域 MUST 同步收放，不出现空白或重叠
- **AND** mouseup 后释放监听、cursor 复位

#### Scenario: 拖拽 previous↔source 内部手柄调整对比栏比例

- **WHEN** 用户在 previous/source 之间的高 8px 拖拽手柄上 mousedown 并水平 mousemove
- **THEN** previous column 占比 MUST clamp 到 [0.2, 0.8] 区间
- **AND** 两栏 MUST 保持 `min-width: 0` 与同步 compare markers

#### Scenario: 双击手柄复位到默认

- **WHEN** 用户在任何 splitter 上双击
- **THEN** 该区域 MUST 回到默认宽度（commit rail 默认 ~26% / 300px、previous 50%）

#### Scenario: 长 diff 行可横向滚动

- **WHEN** 任意一行内容宽度 > 当前 compare column 的可视宽度
- **THEN** CodeMirror cm-scroller MUST 出现横向滚动条
- **AND** compare columns container MUST 不再以 `overflow: hidden` 截断超宽内容
- **AND** File History workspace 整体宽度 MUST NOT 被撑宽

#### Scenario: 720px narrow breakpoint 保留 stack

- **WHEN** inline-size container 宽度 <= 720px
- **THEN** splitter MUST 隐藏、stack 为 commit rail 上 / diff 下的两行布局
- **AND** 现有 container query 行为 MUST 不变

