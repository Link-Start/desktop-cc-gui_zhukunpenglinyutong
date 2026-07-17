## ADDED Requirements

### Requirement: Workspace repository discovery and summaries

The system SHALL discover the workspace root repository and bounded nested repositories and SHALL return an independent summary for each repository.

#### Scenario: Workspace root is a repository
- **WHEN** the workspace root contains a `.git` directory or worktree `.git` file
- **THEN** the summary list SHALL include a root entry whose `repositoryRoot` is an empty string

#### Scenario: Workspace contains nested repositories
- **WHEN** bounded discovery finds nested folders with Git markers
- **THEN** each repository SHALL have a normalized workspace-relative identity and independent branch/working-tree summary

#### Scenario: One repository is unavailable
- **WHEN** one discovered repository cannot be opened because of corruption or permissions
- **THEN** that repository SHALL expose a row-local error
- **AND** other repository summaries SHALL remain available

#### Scenario: Excluded directory is present
- **WHEN** discovery encounters `.git`, `node_modules`, `dist`, `target`, or `release-artifacts`
- **THEN** discovery SHALL NOT recurse into that directory

### Requirement: Repository root scope validation

Repository-scoped Git commands MUST validate the target at the backend trust boundary before reading or mutating Git state.

#### Scenario: Valid relative repository root
- **WHEN** the caller supplies a normalized or platform-native relative path inside the workspace that contains a Git marker
- **THEN** the command SHALL resolve and operate on that repository

#### Scenario: Workspace root scope
- **WHEN** the caller supplies an explicit empty repository root
- **THEN** the command SHALL target the workspace root repository

#### Scenario: Path traversal or absolute path
- **WHEN** the caller supplies an absolute path, parent traversal, platform prefix, or path resolving outside the workspace
- **THEN** the command MUST reject the input before any Git mutation

#### Scenario: Non-repository folder
- **WHEN** the resolved folder has no `.git` directory or file
- **THEN** the command MUST return a readable target validation error

### Requirement: Repository folder decoration

The file tree SHALL distinguish exact Git repository roots from ordinary folders containing changed descendants.

#### Scenario: Nested repository folder is visible
- **WHEN** a file-tree folder path exactly matches a repository summary identity
- **THEN** the row SHALL show repository icon semantics, current branch, sync indicators, and working-tree summary

#### Scenario: Ordinary changed folder is visible
- **WHEN** a folder only contains changed files but is not a repository root
- **THEN** the row SHALL keep ordinary folder Git status semantics
- **AND** it SHALL NOT render repository identity decoration

#### Scenario: Repository is detached or unavailable
- **WHEN** a repository has detached HEAD or summary error state
- **THEN** its row SHALL render an explicit compact detached/unavailable state rather than a misleading branch name

### Requirement: Repository folder Git context menu

The file tree SHALL expose a repository-scoped Git submenu only for exact Git repository folder rows and SHALL reuse existing Git workflows for complex actions.

#### Scenario: Exact repository folder is right-clicked
- **WHEN** a folder path exactly matches a repository summary identity
- **THEN** its context menu SHALL include a Git submenu targeted to that repository
- **AND** the submenu SHALL expose Commit, Add, Ignore, Diff, Compare, History, Rollback, Push, Pull, Fetch, Merge, Rebase, Branches, Tag, Reset, Stash, Remotes, and Clone entry points

#### Scenario: Ordinary folder is right-clicked
- **WHEN** a folder does not exactly match a repository summary identity
- **THEN** its context menu SHALL preserve ordinary file operations
- **AND** it SHALL NOT expose repository-level Git actions

#### Scenario: Risky repository action is selected
- **WHEN** an action needs parameters, preview, confirmation, or may discard/change remote or local history
- **THEN** the system SHALL first select the explicit repository target
- **AND** it SHALL open the existing Git Diff/History workflow instead of duplicating mutation logic in the context menu

#### Scenario: Standalone root repository is right-clicked
- **WHEN** the workspace root is itself a Git repository and the user right-clicks the file-tree root label
- **THEN** the same repository Git submenu SHALL target `repositoryRoot=""`

#### Scenario: Repository submenu placement
- **WHEN** the repository Git submenu opens near a viewport edge
- **THEN** it SHALL choose the nearest viable side and remain clamped inside the viewport
- **AND** it SHALL expose only Commit, Add, Ignore, Diff, Compare, History, Rollback, Push, Pull, and Fetch actions

### Requirement: Adaptive multi-repository Git command center

The Composer Git control SHALL adapt its navigation depth to the number of repositories while preserving an explicit operation target.

#### Scenario: Single repository workspace
- **WHEN** exactly one repository summary is available
- **THEN** opening the control SHALL directly show global actions and recent/local/remote branches for that repository

#### Scenario: Multi-repository workspace
- **WHEN** multiple repository summaries are available
- **THEN** opening the control SHALL first show repository rows with current branch/status
- **AND** selecting one repository SHALL open its repository-scoped actions and branches

#### Scenario: Repository selection is pending
- **WHEN** selecting a repository requires asynchronous Git context and branch loading
- **THEN** the selected row SHALL immediately display loading feedback
- **AND** duplicate repository selections SHALL be ignored until the request settles
- **AND** failure SHALL keep the repository list available with an explicit error

#### Scenario: Branch sections are initially collapsed
- **WHEN** repository branch details first open
- **THEN** Recent, Local, and Remote sections SHALL each be collapsed by default
- **AND** a non-empty branch search SHALL reveal matching sections without permanently changing their collapsed preference

#### Scenario: Repository command center actions
- **WHEN** the user selects Update, Commit, Push, Checkout, or Create Branch for a repository
- **THEN** the action SHALL target only that repository
- **AND** complex Commit/Push workflows SHALL reuse the existing Git surfaces instead of duplicating write logic

#### Scenario: Keyboard and dismissal behavior
- **WHEN** the command center is open
- **THEN** search, repository rows, branch rows, back navigation, actions, and dismissal SHALL be keyboard accessible

### Requirement: Repository state refresh and stale-result safety

The system SHALL refresh repository summaries after Git mutations without introducing high-frequency AppShell polling.

#### Scenario: Mutation succeeds
- **WHEN** a repository-scoped Git mutation completes
- **THEN** repository summaries and branch details SHALL refresh for the affected workspace

#### Scenario: Workspace changes during request
- **WHEN** a summary or branch response resolves for a workspace that is no longer active
- **THEN** the stale response SHALL NOT replace the current workspace state

#### Scenario: Nested repository diff preview settles
- **WHEN** a changed file preview is opened for a nested repository
- **THEN** before/current content SHALL be loaded with that repository's explicit scope and normalized path
- **AND** success, error, and stale completion paths SHALL always settle the visible loading state

#### Scenario: No mutation event occurs
- **WHEN** the UI remains connected and visible without Git events
- **THEN** a fallback refresh MAY run no more frequently than every 30 seconds

### Requirement: Local and remote backend parity

Repository discovery, summaries, branch reads, and repository-scoped actions SHALL preserve request and response semantics in local desktop and remote daemon modes.

#### Scenario: Remote summary request
- **WHEN** remote daemon mode requests repository summaries
- **THEN** desktop Tauri SHALL forward workspace id and depth to the daemon
- **AND** returned repository identities SHALL describe the daemon workspace

#### Scenario: Remote scoped branch action
- **WHEN** remote daemon mode performs a repository-scoped branch action
- **THEN** desktop Tauri SHALL forward the explicit repository root unchanged in semantic value
- **AND** the daemon SHALL apply the same validation as local mode
