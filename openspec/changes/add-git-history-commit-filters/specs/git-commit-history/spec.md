## MODIFIED Requirements

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

## ADDED Requirements

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
