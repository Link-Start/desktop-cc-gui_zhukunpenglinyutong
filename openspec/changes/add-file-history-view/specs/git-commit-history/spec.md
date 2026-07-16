## ADDED Requirements

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
