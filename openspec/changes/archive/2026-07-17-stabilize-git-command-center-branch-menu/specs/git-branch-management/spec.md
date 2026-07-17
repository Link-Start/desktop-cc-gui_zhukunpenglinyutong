## ADDED Requirements

### Requirement: Compact branch hierarchy SHALL expose collapsible path scopes

The compact branch command center SHALL group slash-delimited branch names into one inner scope level and SHALL allow each non-root scope to be independently collapsed.

#### Scenario: Local scope is collapsed

- **WHEN** a local branch path contains a non-root scope and that scope is collapsed
- **THEN** the scope header SHALL remain visible
- **AND** its branch leaf rows SHALL not be rendered until the scope is expanded or search reveals them

#### Scenario: Remote scope is collapsed

- **WHEN** remote branches share a remote/scope grouping and that group is collapsed
- **THEN** the remote/scope header SHALL remain visible
- **AND** only that group's branch leaf rows SHALL be hidden

### Requirement: Repository-scoped current branch update SHALL preserve explicit target

The file-tree repository Update action SHALL reuse the existing branch update operation with both branch name and repository root supplied explicitly.

#### Scenario: Nested repository update

- **WHEN** Update is activated from a nested repository folder
- **THEN** the update request SHALL target the nested repository root and its current branch
- **AND** it SHALL NOT rely on asynchronously changing persisted workspace Git root first
