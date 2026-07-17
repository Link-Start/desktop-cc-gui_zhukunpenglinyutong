## ADDED Requirements

### Requirement: Multi-repository unstaged files support repository-scoped discard
The multi-repository Git commit workspace MUST expose discard only for unstaged files, MUST require explicit user confirmation, and MUST identify the mutation target by `repositoryRoot + path`.

#### Scenario: Unstaged row exposes discard action
- **WHEN** a multi-repository group renders an unstaged file
- **THEN** the file row SHALL display the shared discard action
- **AND** a staged file row SHALL NOT display that action

#### Scenario: Cancel discard leaves repository unchanged
- **WHEN** the user opens discard confirmation for a multi-repository file and cancels
- **THEN** the system MUST NOT invoke the revert mutation

#### Scenario: Confirm discard refreshes repository statuses
- **WHEN** the user confirms discard for an unstaged file
- **THEN** the system SHALL invoke revert with the owning file's explicit `repositoryRoot + path`
- **AND** successful completion SHALL refresh multi-repository statuses

#### Scenario: Same relative path is isolated by repository
- **WHEN** two repository groups both contain the same unstaged relative path and the user confirms discard in one group
- **THEN** the system SHALL revert only the file under the selected group's `repositoryRoot`
- **AND** it MUST NOT route the mutation through the other repository or global repository selection
