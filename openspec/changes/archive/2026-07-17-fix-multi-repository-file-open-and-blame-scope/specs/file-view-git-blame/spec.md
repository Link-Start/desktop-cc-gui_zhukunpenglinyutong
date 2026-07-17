## ADDED Requirements

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
