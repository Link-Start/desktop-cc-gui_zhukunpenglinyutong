# git-command-center-branch-menu-stability Specification

## Purpose
TBD - created by archiving change stabilize-git-command-center-branch-menu. Update Purpose after archive.
## Requirements
### Requirement: Repository command center SHALL preserve branch projection across transient summary emptiness

The system SHALL keep the last-known-good repository selection and branch projection when a refresh produces a single transient empty summary response for the same connected workspace.

#### Scenario: Summary refresh is transiently empty

- **WHEN** a connected workspace previously exposed a selected repository and a later summary refresh returns an empty collection
- **THEN** the selected repository and its visible branch projection SHALL remain stable
- **AND** the UI SHALL NOT flash an empty branch list solely because of that response

#### Scenario: Workspace identity changes

- **WHEN** the active workspace identity changes
- **THEN** the prior repository selection and branch projection SHALL be cleared
- **AND** state from the prior workspace SHALL NOT leak into the new workspace

### Requirement: Branch scope groups SHALL support a second collapsible level

The command center SHALL render non-root local and remote branch scopes as independently collapsible groups beneath their top-level section.

#### Scenario: User toggles an inner scope

- **WHEN** Local or Remote is expanded and the user activates a scope header
- **THEN** only that scope's branch rows SHALL expand or collapse
- **AND** sibling scope expansion preferences SHALL remain unchanged

#### Scenario: Search matches a collapsed scope

- **WHEN** a non-empty branch search matches a branch inside a collapsed scope
- **THEN** the matching scope SHALL be temporarily visible
- **AND** clearing search SHALL restore the user's stored collapse preference

### Requirement: Repository submenu SHALL expose a scoped current-branch update

The exact repository root/folder Git submenu SHALL provide Update and SHALL remove Show Diff, Compare Revision, Compare Branch/Tag, and Rollback from that submenu.

#### Scenario: Current branch can be updated

- **WHEN** the user selects Update for a repository with an available current local branch
- **THEN** the system SHALL call the existing branch update capability with that repository's explicit `repositoryRoot` and `currentBranch`
- **AND** sibling repositories SHALL remain unchanged

#### Scenario: Repository has no updateable current branch

- **WHEN** the repository is detached, unborn, unavailable, or has no current branch
- **THEN** Update SHALL be disabled
- **AND** no branch mutation SHALL be attempted

#### Scenario: Update settles

- **WHEN** Update is pending or completes with success, no-op, blocked, or error
- **THEN** duplicate activation SHALL be prevented while pending
- **AND** the UI SHALL expose a corresponding user-visible result
