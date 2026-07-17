# file-view-git-blame Specification

## Purpose
TBD - created by archiving change add-file-view-git-blame. Update Purpose after archive.
## Requirements
### Requirement: File view Git Blame MUST be explicitly activated

The workspace text editor MUST keep Git Blame disabled by default and MUST load it only after an explicit action for the active file.

#### Scenario: opening a file does not request blame
- **WHEN** a user opens or activates a supported workspace text file without enabling Git Blame
- **THEN** the file view MUST NOT issue `get_git_file_blame`
- **AND** it MUST NOT mount a blame gutter or wait for blame before displaying the file

#### Scenario: user enables blame after editor mount
- **WHEN** the active editor is usable and the user enables Git Blame
- **THEN** the file view MUST request blame asynchronously for the active repository-relative file
- **AND** loading or failure MUST NOT disable editing, navigation, save, or file switching

### Requirement: Git Blame annotations MUST be viewport bounded and informative

The editor MUST display compact line annotations without expanding the full document into React rows.

#### Scenario: visible lines show compact attribution
- **WHEN** blame data is ready and an attributed line is visible
- **THEN** its gutter annotation MUST show a compact date and author
- **AND** non-visible lines MUST NOT require mounted blame DOM

#### Scenario: current line exposes commit details
- **WHEN** an attributed line becomes the current or hovered line
- **THEN** the editor MUST expose short SHA, full authored time and commit summary
- **AND** current-line details MUST render as a line-end inline widget in editor content rather than expanding the blame gutter
- **AND** long metadata MUST be truncated visually while remaining available through an accessible label or title

### Requirement: Git Blame MUST preserve repository and runtime parity

The blame request and response MUST behave consistently in Desktop Tauri and daemon/Web Service modes.

#### Scenario: nested repository is selected
- **WHEN** the active file belongs to a nested Git repository
- **THEN** the request MUST preserve the selected `repositoryRoot`
- **AND** the backend MUST resolve and blame only a repository-relative safe path

#### Scenario: daemon mode requests blame
- **WHEN** the application routes Git commands through the daemon
- **THEN** daemon dispatch MUST return the same hunk and metadata contract as Desktop Tauri

### Requirement: Dirty and unsupported files MUST degrade safely

Git Blame MUST never present known-stale attribution as current and MUST not break the file surface when attribution is unavailable.

#### Scenario: editor becomes dirty
- **WHEN** a blamed editor receives an unsaved document change
- **THEN** the existing attribution MUST be marked stale or hidden immediately
- **AND** typing MUST NOT trigger a new blame request

#### Scenario: blamed dirty file is saved
- **WHEN** a dirty blamed file is saved successfully while blame remains enabled
- **THEN** the file view MUST refresh blame at most once for that save

#### Scenario: file cannot be blamed
- **WHEN** the file is external, binary, untracked, outside the selected repository, over budget, or the repository has no usable HEAD
- **THEN** the file view MUST expose an explicit unavailable reason
- **AND** the underlying file MUST remain readable or editable

### Requirement: Multi-Repository File Blame MUST Resolve The Owning Repository

The file view MUST resolve Git Blame scope from the active file's owning repository when aggregate repository summaries are available, rather than assuming the configured single-repository `gitRoot` owns every file.

#### Scenario: File belongs to a non-configured repository

- **WHEN** a workspace contains multiple repositories and the active file belongs to a repository other than the configured `gitRoot`
- **THEN** Git Blame MUST remain available for that file
- **AND** the request MUST use the owning `repositoryRoot` and repository-relative file path

#### Scenario: Nested repository wins over parent repository

- **WHEN** both a parent repository and a nested repository path-prefix match the active file
- **THEN** Git Blame MUST select the longest matching repository root
- **AND** it MUST remove exactly that root from the request path

#### Scenario: Known repository inventory has no owner

- **WHEN** aggregate repository summaries are available but none owns the active workspace file
- **THEN** Git Blame MUST remain unavailable for that file
- **AND** it MUST NOT fallback to a different configured repository

#### Scenario: Aggregate inventory is unavailable

- **WHEN** aggregate repository summaries are empty or not supplied in a single-repository surface
- **THEN** Git Blame MUST preserve the existing configured `gitRoot` compatibility behavior
