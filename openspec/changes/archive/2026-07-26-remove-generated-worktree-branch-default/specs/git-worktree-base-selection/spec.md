## ADDED Requirements

### Requirement: Worktree branch name MUST be explicitly provided

The Create Worktree dialog MUST initialize branch name as empty and MUST require the user to enter a Git-valid branch name before creation. The system MUST NOT generate an engine, date, random, workspace, or inferred task branch name when the dialog opens.

#### Scenario: User opens Create Worktree dialog

- **WHEN** the user opens the Create Worktree dialog
- **THEN** the branch name field MUST be empty
- **AND** the create action MUST remain unavailable until a valid branch name and baseRef are provided

#### Scenario: User provides a valid branch name

- **WHEN** the user enters a valid branch name and selects a valid baseRef
- **THEN** the system MUST pass the exact user-provided branch name through the existing create-worktree flow
- **AND** publish and setup-script behavior MUST remain unchanged

#### Scenario: Dialog is reopened

- **WHEN** the dialog is closed and opened again for any workspace
- **THEN** the branch name field MUST reset to empty
- **AND** MUST NOT retain a previous user value or generated fallback
