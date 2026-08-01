## MODIFIED Requirements

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
