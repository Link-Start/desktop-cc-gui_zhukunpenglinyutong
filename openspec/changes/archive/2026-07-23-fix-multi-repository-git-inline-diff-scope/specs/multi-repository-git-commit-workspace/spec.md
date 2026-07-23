## ADDED Requirements

### Requirement: Multi-repository center diff MUST preserve repository identity

Center-area local diff selection from a multi-repository Git changes group MUST use `repositoryRoot + path` as the file identity and MUST load diff content from that explicit repository scope.

#### Scenario: Open nested repository inline diff

- **WHEN** the user activates inline preview for a changed file in a nested repository group
- **THEN** the selection callback MUST carry that group's exact `repositoryRoot` and repository-relative `path`
- **AND** the client MUST request local diffs using the active `workspaceId + repositoryRoot`
- **AND** the center diff MUST select the requested path from the scoped response

#### Scenario: Same relative path exists in multiple repositories

- **WHEN** two repository groups both contain the same relative path and the user previews one of them
- **THEN** center diff MUST render content from the selected owning repository only
- **AND** it MUST NOT reuse or fall back to another repository's matching path

#### Scenario: Scoped diff request changes identity

- **WHEN** active workspace、repository scope or selected path changes before a scoped diff request settles
- **THEN** stale completion MUST NOT overwrite the current center diff state
- **AND** clearing the path or changing workspace MUST clear the previous repository scope

#### Scenario: Scoped diff request fails

- **WHEN** the selected repository's local diff request fails
- **THEN** center diff MUST expose that scoped error and settle its loading state
- **AND** it MUST NOT silently show workspace-root or another repository's diff

#### Scenario: Selection has no explicit repository scope

- **WHEN** a single-repository、workspace-root、commit or pull-request diff selection omits `repositoryRoot`
- **THEN** the existing corresponding diff source and behavior MUST remain unchanged

### Requirement: Multi-repository unstaged sections MUST support scoped discard-all

Each multi-repository unstaged section MAY expose discard-all only when a repository-scoped revert callback is available, and every mutation MUST retain the owning repository identity.

#### Scenario: Discard all unstaged files in one repository

- **WHEN** the user activates discard-all in one repository's unstaged section
- **THEN** the confirmation target MUST contain that exact `repositoryRoot` and the section's unstaged paths
- **AND** staged paths and paths from other repository groups MUST NOT be included

#### Scenario: User cancels repository discard-all

- **WHEN** the confirmation dialog is cancelled
- **THEN** no revert mutation MUST execute
- **AND** repository statuses MUST remain unchanged

#### Scenario: User confirms repository discard-all

- **WHEN** the user confirms the repository-scoped discard target
- **THEN** the client MUST invoke the existing revert operation for each path with the same exact `repositoryRoot`
- **AND** it MUST refresh aggregate repository statuses after the scoped operations settle
- **AND** duplicate confirmation while submission is pending MUST be ignored

#### Scenario: Staged section renders

- **WHEN** a multi-repository staged section renders
- **THEN** it MUST NOT expose discard-all

### Requirement: Center diff mode MUST own the central content height

Desktop center diff mode MUST render without the bottom Composer so the diff surface uses the available central content height.

#### Scenario: Enter center diff mode

- **WHEN** `centerMode` becomes `diff`
- **THEN** the central diff layer MUST remain interactive
- **AND** the bottom Composer MUST NOT render below it

#### Scenario: Leave center diff mode

- **WHEN** the user returns to a center mode whose existing layout includes the Composer
- **THEN** the Composer MUST resume its prior placement without losing conversation state
