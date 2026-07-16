## ADDED Requirements

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

The system SHALL render an independent File History view with a commit list and a selected-commit file diff without modifying the general Git History panel layout.

#### Scenario: First history page loads
- **WHEN** File History opens for a valid tracked file
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

The File History view MUST expose loading, error, retry, empty, binary/image, and close behavior without initiating Git mutations.

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

#### Scenario: Close file history
- **WHEN** user invokes the File History close action
- **THEN** the system SHALL remove the active file history target and return to the normal workspace surface
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
