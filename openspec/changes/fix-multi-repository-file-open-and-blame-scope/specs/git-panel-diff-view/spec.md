## ADDED Requirements

### Requirement: Multi-Repository Changed-File Direct Opens MUST Preserve Repository Identity

The Git Diff panel MUST carry the owning `repositoryRoot` with every multi-repository changed-file direct-open request until the repository-relative path is projected into the shared workspace-relative editor path.

#### Scenario: Click a changed file in a nested repository

- **WHEN** 用户单击 multi-repository changed-file row
- **THEN** editor MUST open the file under that row's owning `repositoryRoot`
- **AND** the open action MUST NOT depend on or mutate the configured single-repository `gitRoot`

#### Scenario: Same relative path exists in different repositories

- **WHEN** two repositories each expose a changed file with the same repository-relative path
- **AND** 用户依次单击两个 rows
- **THEN** each open request MUST resolve to its distinct workspace-relative path
- **AND** one repository MUST NOT reuse the other repository's tab identity

#### Scenario: Workspace-root repository is explicitly selected by the row

- **WHEN** a multi-repository row belongs to the workspace-root repository represented by an empty `repositoryRoot`
- **THEN** its repository-relative path MUST remain workspace-relative without an added nested-root prefix
- **AND** a configured nested `gitRoot` MUST NOT override the explicit workspace-root identity

#### Scenario: Existing single-repository file open remains compatible

- **WHEN** a single-repository changed-file caller omits a repository override
- **THEN** the editor MUST continue resolving Git-domain paths through the configured `gitRoot`
- **AND** non-Git file entrypoints MUST continue treating their paths as workspace-domain inputs

### Requirement: Multi-Repository File Actions MUST Keep One Repository Scope Contract

Every multi-repository changed-file action that consumes a repository-relative path MUST either carry its owning `repositoryRoot` or intentionally operate on an already projected workspace-relative path.

#### Scenario: Repository-aware action audit

- **WHEN** direct open, modal preview, stage, unstage, commit selection, file tree decoration and file history entrypoints are exercised for multiple repositories
- **THEN** each Git-domain action MUST preserve the owning repository identity
- **AND** changed-file direct-open handlers MUST NOT be replaced by noop adapters
