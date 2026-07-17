## REMOVED Requirements

### Requirement: Four-Region Git Log Workspace

**Reason**: 最左侧 overview/worktree 区域重复占用横向空间，产品布局改为聚焦 branch、commit 与 details 的三栏主流程。

**Migration**: Git History 不再提供 overview/worktree surface；worktree commit 操作继续使用主 Git panel 的 canonical commit surface。

## ADDED Requirements

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
