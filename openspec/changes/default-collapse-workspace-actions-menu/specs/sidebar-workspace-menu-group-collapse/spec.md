## ADDED Requirements

### Requirement: Workspace Actions Group Defaults To Collapsed

The workspace menu MUST render the workspace actions group collapsed whenever a new workspace menu instance opens, while leaving the new-session group expanded.

#### Scenario: Open workspace menu

- **WHEN** a user opens a workspace menu containing the new-session and workspace-actions groups
- **THEN** the workspace-actions header is visible with collapsed semantics
- **AND** its action rows are not rendered
- **AND** the new-session action rows remain visible

#### Scenario: Reopen workspace menu

- **WHEN** a user closes an expanded workspace menu and opens it again
- **THEN** the workspace-actions group returns to its default collapsed state

### Requirement: Workspace Actions Group Supports Accessible Temporary Toggle

The workspace-actions group header MUST support pointer and keyboard activation, MUST expose its current expanded state to assistive technology, and MUST preserve all existing child action behavior while expanded.

#### Scenario: Expand workspace actions

- **WHEN** a user activates the collapsed workspace-actions header
- **THEN** the header reports an expanded state
- **AND** all configured workspace action rows become available

#### Scenario: Collapse workspace actions again

- **WHEN** a user activates the expanded workspace-actions header
- **THEN** the header reports a collapsed state
- **AND** its action rows are removed from the rendered menu

#### Scenario: Invoke an existing action after expansion

- **WHEN** a user expands workspace-actions and activates an existing action or pin control
- **THEN** the pre-existing action or pin handler runs with unchanged semantics
