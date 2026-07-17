# git-commit-history Specification

## Purpose

Defines the git-commit-history behavior contract, covering Paginated History Loading.
## Requirements
### Requirement: Paginated History Loading

The system SHALL load commit history incrementally in pages.

#### Scenario: Initial load

- **WHEN** panel opens
- **THEN** system loads first page (default 100 commits)

#### Scenario: Load next page

- **WHEN** user scrolls near list bottom
- **THEN** system loads next page and appends rows

#### Scenario: Stable pagination snapshot

- **WHEN** user continues paging within one view session
- **THEN** system uses a stable snapshot to avoid duplicate or missing rows during refresh

---

### Requirement: Commit Graph and Metadata Row

Each commit row SHALL include graph semantics and metadata columns.

#### Scenario: Row content

- **WHEN** a commit row is rendered
- **THEN** row shows graph node/edge, subject, refs, author, and relative time

#### Scenario: Merge commit graph

- **WHEN** commit has multiple parents
- **THEN** graph includes branch merge edges in row rendering

---

### Requirement: Search by Query Tokens

The system SHALL support free-text and tokenized search.

#### Scenario: Search by subject text

- **WHEN** user enters plain text in search
- **THEN** commits are filtered by subject/message substring (case-insensitive)

#### Scenario: Search by author token

- **WHEN** user enters `author:<name>`
- **THEN** system filters commits authored by matching user

#### Scenario: Search by hash

- **WHEN** user enters full or partial hash
- **THEN** system filters commits by hash prefix/substring match

---

### Requirement: Structured Filters

The system SHALL support branch, author, and date filters for commit history, and SHALL allow these filters to be combined.

#### Scenario: Branch filter

- **WHEN** user selects a branch from the branch list or Branch filter control
- **THEN** the middle column SHALL show commits reachable from that branch
- **AND** both branch controls SHALL reflect the same selected branch

#### Scenario: Author filter

- **WHEN** user enters an author name or email in the User filter
- **THEN** the system SHALL return only commits whose author metadata matches case-insensitively

#### Scenario: Date range filter

- **WHEN** user selects Today, Last 7 days, or Last 30 days
- **THEN** the system SHALL send a stable epoch-second `dateFrom/dateTo` range
- **AND** only commits within that range SHALL be returned

#### Scenario: Combined structured filters

- **WHEN** branch, author, date, and text/Hash filters are active together
- **THEN** the system SHALL apply all active filters in one server-side history request
- **AND** total and load-more results SHALL represent the combined filter scope

#### Scenario: Clear filters

- **WHEN** user activates Clear filters
- **THEN** query, author, and date SHALL reset
- **AND** branch scope SHALL return to the current branch when available, otherwise all branches
- **AND** any pending query or author debounce SHALL be cancelled
- **AND** a stale draft SHALL NOT reapply after clear

#### Scenario: Filter toolbar placement

- **WHEN** the commit column renders its filter surface
- **THEN** Branch, User, Date, and Clear controls SHALL render inside the same column header container as the commit title
- **AND** the text/Hash search field SHALL render in a separate row below that header
- **AND** Branch and Date dropdowns SHALL remain anchored to their own triggers

#### Scenario: Author email identity visibility

- **WHEN** an active User filter, including a partial email value, matches a commit by author email but not by display name
- **THEN** the matching email SHALL be visible in that commit's metadata
- **AND** the displayed author name SHALL remain unchanged

#### Scenario: All branches in Desktop and remote daemon

- **WHEN** branch scope is `"all"` or `"*"`
- **THEN** Desktop and remote daemon SHALL traverse local and remote branch refs
- **AND** neither backend SHALL resolve the special scope as a literal branch name

### Requirement: Jump to Commit

The system SHALL allow jumping to target commit by hash or reference.

#### Scenario: Jump by hash

- **WHEN** user inputs hash and confirms
- **THEN** system scrolls to and selects matching commit

#### Scenario: Jump by reference

- **WHEN** user inputs branch/tag reference
- **THEN** system resolves reference and selects tip commit

#### Scenario: Target not found

- **WHEN** hash/reference does not exist
- **THEN** system shows `Commit not found`

---

### Requirement: Commit Context Menu Actions

The commit row context menu SHALL expose grouped history actions with deterministic order, and SHALL include the
priority actions `Copy Revision Number` and `Reset Current Branch to Here`.

#### Scenario: Open context menu

- **WHEN** user right-clicks a commit row
- **THEN** menu SHALL include grouped actions in fixed order:
    - `Quick`: `Copy Revision Number`, `Copy Commit Message`
    - `Branch`: `Create Branch from Here`, `Reset Current Branch to Here...`
    - `Write`: `Cherry-Pick`, `Revert Commit`

#### Scenario: Copy revision number

- **WHEN** user clicks `Copy Revision Number`
- **THEN** full selected commit hash SHALL be copied to clipboard
- **AND** system SHALL provide success feedback

#### Scenario: Reset action is confirmation-first

- **WHEN** user clicks `Reset Current Branch to Here...`
- **THEN** system SHALL open reset confirmation dialog
- **AND** system SHALL NOT execute git reset before explicit confirm

#### Scenario: Context menu and action button group stay consistent

- **WHEN** selected commit or repository operation state changes
- **THEN** context menu action availability SHALL match the linked commit action button group
- **AND** disabled reason text SHALL remain consistent between both entry points

### Requirement: Selection Persistence

The system SHALL preserve selected commit state across panel toggles.

#### Scenario: Persist selection

- **WHEN** user selects a commit and closes panel
- **THEN** selected commit hash is persisted

#### Scenario: Restore selection

- **WHEN** user reopens panel
- **THEN** system reselects previous commit if still available in current filter scope

---

### Requirement: Relative Time Formatting

Commit time SHALL be displayed in user-friendly relative format.

#### Scenario: Recent time

- **WHEN** commit age < 24 hours
- **THEN** time uses `minutes ago` or `hours ago`

#### Scenario: Older time

- **WHEN** commit age >= 7 days
- **THEN** time uses absolute date format (for example `Jan 15, 2026`)

### Requirement: Remote Backend Git History Reads

Git history surfaces SHALL read commit, branch comparison, and worktree comparison data from the active backend location. In remote daemon mode, desktop commands for history, commit details, commit diffs, ref resolution, branch compare, branch diffs, and worktree diffs MUST delegate to daemon RPC.

#### Scenario: Remote commit history uses daemon repository state

- **WHEN** the app is in remote daemon mode and Git history loads commits or commit details
- **THEN** desktop commands MUST call daemon RPC for history/detail/diff/ref-resolution methods
- **AND** returned commit data MUST reflect the daemon-side repository

#### Scenario: Remote branch compare uses daemon repository state

- **WHEN** the app is in remote daemon mode and the user compares branches
- **THEN** branch compare and branch diff commands MUST execute through daemon RPC
- **AND** local desktop repository discovery MUST NOT be used

#### Scenario: Remote worktree diff uses daemon repository state

- **WHEN** the app is in remote daemon mode and the user opens a worktree diff against a branch
- **THEN** worktree diff commands MUST execute through daemon RPC
- **AND** daemon-side path semantics MUST be preserved in the returned diff payload

#### Scenario: Local history behavior remains unchanged

- **WHEN** the app is in local backend mode and Git history loads data
- **THEN** existing local history, compare, and worktree diff behavior MUST be preserved

### Requirement: Commit history supports optional file path scope

The `get_git_commit_history` contract SHALL accept an optional normalized repository-relative `path`. When omitted, existing repository-wide history behavior MUST remain unchanged.

#### Scenario: Path-scoped history returns only touching commits
- **WHEN** caller supplies a valid repository-relative file path
- **THEN** the backend SHALL return only commits selected by Git file history semantics for that path
- **AND** SHALL preserve the existing `GitHistoryResponse` pagination and commit metadata schema

#### Scenario: File rename history is followed
- **WHEN** the target file was renamed within the selected history
- **THEN** path-scoped history SHALL include commits from the pre-rename path according to Git `--follow` semantics
- **AND** each returned file-history commit SHALL expose its repository-relative path at that commit

#### Scenario: Invalid path is rejected
- **WHEN** caller supplies an absolute path, parent traversal, empty normalized path, or path outside the selected repository
- **THEN** backend MUST return an explicit validation error
- **AND** MUST NOT execute history outside the selected repository

#### Scenario: Existing repository history omits path
- **WHEN** caller does not supply `path`
- **THEN** branch/query/author/date filtering, ordering, pagination, refs, and existing response behavior MUST remain unchanged

### Requirement: File path participates in history snapshot identity

Path-scoped pagination MUST bind its snapshot to repository HEAD, filters, selected repository, and normalized file path.

#### Scenario: Continue same file snapshot
- **WHEN** caller requests the next page with the unchanged path and valid snapshot id
- **THEN** backend SHALL return the next page for the same file history sequence

#### Scenario: Reuse snapshot for another file
- **WHEN** caller reuses a snapshot id with a different normalized path
- **THEN** backend MUST reject the snapshot as expired or mismatched
- **AND** MUST NOT return commits from the previous file scope

### Requirement: Remote backend preserves path-scoped history

Desktop Tauri forwarding and daemon dispatch MUST preserve the optional path field and repository root exactly.

#### Scenario: Remote file history query
- **WHEN** application is in remote daemon mode and File History requests commits
- **THEN** desktop command SHALL forward `path`, filters, snapshot, pagination, and `repositoryRoot` to daemon RPC
- **AND** returned commits MUST reflect daemon-side repository state

#### Scenario: Remote selected image diff
- **WHEN** remote File History selects an image commit
- **THEN** daemon diff mapping SHALL identify the image and return old/new image payloads with the same schema as Desktop local mode

#### Scenario: Local file history query
- **WHEN** application is in local backend mode and File History requests commits
- **THEN** the command SHALL execute against the selected local repository root
- **AND** MUST return the same path-scoped response contract as daemon mode

### Requirement: Stable Author Timeline Accent

The Git History commit list SHALL assign a deterministic visual accent to each commit author identity without replacing textual author metadata or interaction-state feedback.

#### Scenario: Resolve author identity

- **WHEN** a commit row includes `authorEmail`
- **THEN** the system SHALL derive its author accent from normalized `authorEmail`
- **AND** when `authorEmail` is absent the system SHALL fall back to normalized `author`
- **AND** when both values are absent the system SHALL use one stable fallback accent

#### Scenario: Preserve color across list lifecycle

- **WHEN** the same author appears after refresh, pagination, search filtering, or virtualized row reuse
- **THEN** the system SHALL render the same author accent independent of row position or discovery order

#### Scenario: Distinguish authors in the timeline

- **WHEN** visible commits resolve to different palette slots
- **THEN** their graph nodes SHALL use different author accents
- **AND** each row line segment SHALL use a subdued form of its node accent
- **AND** the author label SHALL retain readable contrast against the active application theme

#### Scenario: Preserve interaction semantics

- **WHEN** a commit row is hovered, focused, or selected
- **THEN** existing interaction-state styling SHALL remain visible
- **AND** author color SHALL remain an auxiliary cue rather than the only way to identify the author

### Requirement: Commit Filter Application Stability

The Git History panel SHALL apply filters without issuing per-keystroke history scans or allowing stale asynchronous results to overwrite the latest scope.

#### Scenario: Debounce free-text filters

- **WHEN** user continuously edits query or User input
- **THEN** the panel SHALL wait 300ms after the latest edit before applying filters
- **AND** only the latest settled values SHALL enter the backend request

#### Scenario: Apply discrete filters immediately

- **WHEN** user changes Branch, Date preset, or activates Clear
- **THEN** the new filter scope SHALL apply immediately without waiting for the text debounce

#### Scenario: Preserve filter payload during pagination

- **WHEN** user loads another page or the panel retries an expired snapshot
- **THEN** the request SHALL reuse the same branch, query, author, date, and repository scope as the first page
- **AND** the date range SHALL remain stable for that snapshot lifecycle

#### Scenario: Re-anchor date range for a new snapshot

- **WHEN** user starts a new first-page request without changing the active Date preset
- **THEN** the panel SHALL resolve a fresh epoch-second date range for that request
- **AND** subsequent pagination and snapshot retry SHALL reuse that fresh range

#### Scenario: Ignore stale history response

- **WHEN** an older history request resolves after workspace, repository, or applied filters changed
- **THEN** the panel SHALL ignore that response and its loading/error settlement
- **AND** the latest commits, total, snapshot, and error state SHALL remain unchanged

#### Scenario: Isolate pending drafts across workspace scopes

- **WHEN** workspace scope changes before a query or User debounce settles
- **THEN** the pending timer from the previous scope SHALL be cancelled
- **AND** only the restored filters for the new scope SHALL be eligible for application

### Requirement: Commit Filter Persistence

The Git History panel SHALL persist applied commit filters as scoped panel state and restore only validated values.

#### Scenario: Restore applied filters

- **WHEN** user closes and reopens Git History for the same persistence scope
- **THEN** query, author, date preset, and selected branch SHALL restore
- **AND** restored values SHALL drive the initial server-side request

#### Scenario: Sanitize persisted date preset

- **WHEN** persisted date preset is missing or not one of `all`, `today`, `7d`, or `30d`
- **THEN** the panel SHALL fall back to `all`
- **AND** it SHALL NOT send an invalid date range
