## ADDED Requirements

### Requirement: Git operations support explicit repository scope
Git status、stage、unstage、revert、commit、pull、push、sync、fetch 与 branch update operations MUST accept an optional `repositoryRoot` and resolve the target repository deterministically inside the workspace boundary。

#### Scenario: Repository root is omitted
- **WHEN** a legacy caller omits `repositoryRoot`
- **THEN** the operation SHALL continue using the configured Git root

#### Scenario: Workspace root is explicit
- **WHEN** caller passes `repositoryRoot=""`
- **THEN** the operation SHALL target the workspace root repository

#### Scenario: Nested repository is explicit
- **WHEN** caller passes a normalized discovered child repository root
- **THEN** status and mutation SHALL execute only in that child repository

#### Scenario: Repository scope escapes workspace or is unknown
- **WHEN** caller passes an absolute、parent-traversal or undiscovered repository path
- **THEN** backend MUST reject the operation with a readable scoped error
- **AND** backend MUST NOT silently fallback to the configured repository

### Requirement: Scoped Git mutation preserves repository-level outcomes
Repository-scoped Git mutations MUST preserve enough identity for frontend orchestration to attribute success and failure to the correct repository。

#### Scenario: Scoped mutation succeeds
- **WHEN** a scoped stage、commit or push succeeds
- **THEN** result SHALL be attributable to the requested `repositoryRoot`

#### Scenario: Scoped network mutation fails
- **WHEN** pull、push、sync、fetch or update fails for one repository
- **THEN** error SHALL include operation context without leaking secrets
- **AND** failure SHALL NOT mutate another repository
