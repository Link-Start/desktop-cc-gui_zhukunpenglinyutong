## ADDED Requirements

### Requirement: Git Diff File Context Menu SHALL Expose Clicked-File History

The Git Diff panel SHALL expose `Git -> 显示文件历史` for a changed-file row when the host provides File History navigation and the row can be mapped to a valid workspace/repository/file identity. The History action MUST remain read-only and MUST target the clicked row rather than the current bulk mutation selection.

#### Scenario: Single root repository row opens file history

- **WHEN** the user activates `显示文件历史` for a single-repository changed-file row whose Git root is the workspace root
- **THEN** the system SHALL open File History with the active `workspaceId/workspacePath`
- **AND** it SHALL use `repositoryRoot=""` and the normalized repository-relative clicked path.

#### Scenario: Single nested repository row opens file history

- **WHEN** the active single repository is nested below the workspace root
- **AND** the user activates `显示文件历史` for one of its changed-file rows
- **THEN** the target SHALL use the normalized workspace-relative repository root
- **AND** `path` SHALL remain repository-relative while `displayPath` SHALL be workspace-relative.

#### Scenario: Multi repository row preserves explicit identity

- **WHEN** two repository groups contain the same relative path
- **AND** the user activates History on one group
- **THEN** the target MUST preserve that row's exact `repositoryRoot + path`
- **AND** `repositoryRoot=""` MUST remain an explicit workspace-root identity.

#### Scenario: History ignores bulk mutation selection

- **WHEN** multiple single-repository changed files are selected
- **AND** the user activates History from one clicked row
- **THEN** the system SHALL open exactly the clicked file's history
- **AND** it SHALL NOT derive the History target from the selected path collection.

#### Scenario: Read-only history remains available without mutations

- **WHEN** a valid status-backed row is diff-only or `mutationDisabled`
- **AND** the host provides File History navigation
- **THEN** the Git submenu SHALL expose `显示文件历史`
- **AND** it SHALL NOT expose Stage, Unstage, or Discard.

#### Scenario: Invalid history capability does not create a dead entry

- **WHEN** the host callback, workspace identity, repository scope, or valid relative path is unavailable
- **THEN** the system SHALL omit `显示文件历史`
- **AND** it SHALL preserve any independently available mutation actions.

#### Scenario: History menu target becomes stale

- **WHEN** workspace path, repository topology, or File History callback identity changes while a Git Diff file menu is open
- **THEN** the system SHALL close that file menu
- **AND** the previous History target SHALL NOT remain activatable.
