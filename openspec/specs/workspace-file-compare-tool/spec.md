# workspace-file-compare-tool Specification

## Purpose
TBD - created by archiving change add-workspace-file-compare-tool. Update Purpose after archive.
## Requirements
### Requirement: Workspace file compare SHALL open from selected files

The system SHALL allow users to compare multiple selected workspace files from the Files panel without leaving the main workspace window.

#### Scenario: compare action appears for two selected files
- **GIVEN** the user has selected two file nodes in the Files panel
- **WHEN** the user opens the file tree context menu from one selected file
- **THEN** the menu SHALL include a file compare action

#### Scenario: compare action opens center compare surface
- **GIVEN** the user has selected at least two supported file nodes
- **WHEN** the user chooses the file compare action
- **THEN** the center area SHALL switch to the workspace file compare surface
- **AND** the compare surface SHALL render one column per selected file up to the supported file limit

#### Scenario: compare action refuses selections above the supported file limit
- **GIVEN** the user has selected more than four file nodes
- **WHEN** the user tries to start file compare
- **THEN** the system SHALL NOT silently compare only a subset of the selected files
- **AND** the system SHALL show a readable prompt asking the user to reduce the selection

#### Scenario: compare action is unavailable for insufficient files
- **GIVEN** the current file tree selection contains fewer than two file nodes
- **WHEN** the user opens the file tree context menu
- **THEN** the system SHALL NOT expose an enabled file compare action

#### Scenario: compare action excludes folders
- **GIVEN** the current file tree selection contains files and folders
- **WHEN** the user opens the file tree context menu
- **THEN** file compare eligibility SHALL be computed from selected file nodes only
- **AND** folders SHALL NOT be expanded recursively for compare input

### Requirement: Workspace file compare SHALL support editable file columns

The system SHALL render workspace compare columns as editable text columns when the target file is a supported writable text file.

#### Scenario: editable text file column loads content
- **WHEN** the workspace file compare surface opens for a supported text file
- **THEN** the corresponding column SHALL load the file content through the existing workspace file read contract
- **AND** the column SHALL render an editable text editor

#### Scenario: saving edited compare column writes workspace file
- **GIVEN** a workspace compare column has unsaved local edits
- **WHEN** the user saves that column
- **THEN** the system SHALL write the latest content through the existing workspace file save contract
- **AND** the column SHALL clear its dirty indicator after successful save

#### Scenario: save failure remains visible
- **GIVEN** saving a compare column fails
- **WHEN** the write request rejects
- **THEN** the system SHALL keep the local draft
- **AND** the system SHALL show a readable error message

#### Scenario: editor draft is not silently discarded by compare save
- **GIVEN** the same workspace file is open in a normal editor tab and a compare column
- **WHEN** the user edits or saves either surface
- **THEN** the system SHALL NOT clear the other surface's unsaved local draft as a side effect
- **AND** each surface SHALL keep using the existing workspace file document save and external-change handling semantics

#### Scenario: unsupported file remains read-only
- **WHEN** a selected compare target is binary, truncated, invalid, or otherwise unsupported for text editing
- **THEN** the corresponding column SHALL render a stable read-only state
- **AND** the system SHALL show the reason that editing is unavailable

### Requirement: File compare SHALL show textual differences

The system SHALL compute and display textual differences between compare columns in a stable, readable way.

#### Scenario: changed lines are highlighted
- **GIVEN** at least two compare columns have loaded text
- **WHEN** their line content differs
- **THEN** the compare surface SHALL highlight changed line regions in each affected column

#### Scenario: equal files show no-difference state
- **GIVEN** all loaded compare columns have identical text
- **WHEN** diff calculation completes
- **THEN** the compare surface SHALL show an equivalent no-differences state

#### Scenario: edited content refreshes diff
- **GIVEN** the user edits a compare column
- **WHEN** the local text changes
- **THEN** the compare surface SHALL recompute differences from the latest local drafts
- **AND** the system SHALL NOT wait for a save before updating the visible diff

### Requirement: Scratch text compare SHALL open from the top tool menu

The system SHALL provide a top tool menu entry that opens a two-pane scratch text compare surface.

#### Scenario: top menu opens scratch compare
- **WHEN** the user selects file compare from the top tool menu
- **THEN** the center area SHALL switch to scratch compare mode
- **AND** the compare surface SHALL render left and right editable text areas

#### Scenario: scratch compare does not write files
- **GIVEN** the user has entered text into scratch compare
- **WHEN** the user edits either side
- **THEN** the system SHALL recompute textual differences
- **AND** the system SHALL NOT write to any workspace file

#### Scenario: scratch compare starts empty
- **WHEN** scratch compare opens from the top tool menu
- **THEN** both text panes SHALL start empty unless a future explicit input source provides text

### Requirement: Compare surface SHALL preserve existing editor state

The system SHALL isolate file compare lifecycle from the existing file editor tabs and composer layout.

#### Scenario: opening compare keeps editor tabs
- **GIVEN** the user has existing open editor file tabs
- **WHEN** the user opens workspace file compare or scratch compare
- **THEN** the system SHALL preserve the existing editor tab list
- **AND** returning to editor mode SHALL restore the previous active editor file

#### Scenario: closing compare returns to chat
- **WHEN** the user closes the file compare surface
- **THEN** the center area SHALL return to chat unless the controller explicitly restores another mode
- **AND** closing compare SHALL NOT clear file tree selection or open editor tabs

#### Scenario: compare does not render global composer underneath
- **WHEN** the center area renders file compare
- **THEN** the compare surface SHALL use the available center height
- **AND** the global composer SHALL NOT obscure the compare editors

### Requirement: Large File Compare SHALL Preserve Sequence Alignment

系统 SHALL 在 workspace file compare 的大文件输入超过 full-matrix 预算时继续使用 line-sequence alignment，使局部 edits 不会扩大为整段 false-positive differences。

#### Scenario: local insertion does not shift the unchanged suffix

- **GIVEN** 两个 large compare columns 仅在中间插入少量行
- **WHEN** diff calculation 超过 full-matrix cell budget
- **THEN** inserted lines SHALL 被标记为 changed
- **AND** insertion 之后内容相同的行 SHALL 保持对齐且不得标记为 changed

#### Scenario: multiple distant edits retain stable gaps

- **GIVEN** large compare columns 包含多个相距较远的 insertion 与 deletion regions
- **WHEN** compare surface 构建 line markers 与 gap decorations
- **THEN** markers SHALL 只覆盖真实 changed line numbers
- **AND** gap decorations SHALL 在每个 edit region 后重新收敛到 shared unchanged lines

#### Scenario: small compare behavior remains compatible

- **GIVEN** compare inputs 未超过 full-matrix cell budget
- **WHEN** diff calculation runs
- **THEN** existing replacement pairing 与 n-way gaps SHALL 保持原有语义

#### Scenario: edit distance exceeds the bounded jsdiff limit

- **GIVEN** large compare columns 在文件前部新增超过 2048 行
- **AND** insertion 后仍存在 large shared unchanged suffix
- **WHEN** bounded `diffArrays` 主动终止
- **THEN** fallback SHALL 使用单调 shared unique-line anchors 重新收敛
- **AND** unchanged suffix SHALL NOT 因 index fallback 被标记为 changed
- **AND** fallback SHALL 保持 bounded memory，不得进入 full quadratic matrix

### Requirement: Compare Navigation SHALL Count Contiguous Difference Blocks

系统 SHALL 使用 shared aligned rows 将连续 changed rows 聚合为 navigation blocks，同时保留逐行 markers 与 changed line numbers。

#### Scenario: adjacent changed rows form one navigation target

- **GIVEN** 一个 change region 包含多个连续 changed rows
- **WHEN** compare result 构建 navigation data
- **THEN** 这些 rows SHALL 只计为一个 diff block
- **AND** block anchor SHALL 使用第一条 changed row 的 aligned row 与 column line numbers

#### Scenario: unchanged row separates navigation blocks

- **GIVEN** 两组 changed rows 之间至少存在一条 unchanged aligned row
- **WHEN** previous/next navigation 遍历 compare result
- **THEN** 两组 changed rows SHALL 计为两个 diff blocks
- **AND** navigation SHALL 分别定位两个 block 的首行

### Requirement: Compare Alignment Gaps SHALL Be Visually Explicit

系统 SHALL 在 shared compare editor 中区分 alignment gap 与 source 中的真实空行，同时保持 column header 紧凑可扫描。

#### Scenario: role and path share one header row

- **GIVEN** compare column 同时存在 role label 与 file path
- **WHEN** column header 渲染
- **THEN** 两者 SHALL 位于同一行
- **AND** path SHALL 在空间不足时 ellipsis，header actions SHALL 保持可见
- **AND** all column headers SHALL 使用相同 fixed height，不得按各自 action content 独立撑高
- **AND** all editor top edges SHALL 保持 pixel-level horizontal alignment

#### Scenario: visual gap uses diagonal hatch treatment

- **GIVEN** compare alignment 产生一个或多个 missing rows
- **WHEN** gap widget 渲染对应高度
- **THEN** widget SHALL 保留空白感并叠加从左下向右上的 subtle diagonal hatch
- **AND** actual blank source lines SHALL NOT 获得 gap pattern

#### Scenario: gap height follows measured editor line height

- **GIVEN** compare editor 已产生 measured `view.defaultLineHeight`
- **AND** alignment gap 表示 N 个 missing rows
- **WHEN** gap widget 计算 block height
- **THEN** height SHALL 等于 `N × view.defaultLineHeight` pixels
- **AND** multiple gaps SHALL NOT 累积左右 column vertical offset

