## ADDED Requirements

### Requirement: Git Diff Changed-File Context Menus SHALL Be Unified

The Git Diff panel SHALL expose the same `Git` context submenu for mutation-enabled changed-file rows in single-repository and multi-repository modes. The menu SHALL reuse the shared renderer context-menu surface and SHALL NOT fall back to the WebView native context menu.

#### Scenario: single and multi repository rows use the same Git submenu

- **WHEN** the user opens the context menu for a status-backed single-repository flat/tree row or multi-repository grouped row
- **THEN** the system SHALL prevent the WebView native context menu
- **AND** it SHALL render a root `Git` submenu using the shared `RendererContextMenu`
- **AND** repository topology SHALL NOT change the submenu presentation or action ordering.

#### Scenario: staged row exposes only unstage

- **WHEN** the user opens the Git submenu for a staged changed-file row
- **THEN** the submenu SHALL expose `Unstage file`
- **AND** it SHALL NOT expose Stage or Discard actions for that staged row.

#### Scenario: unstaged row exposes stage and discard

- **WHEN** the user opens the Git submenu for an unstaged changed-file row
- **THEN** the submenu SHALL expose `Stage file`
- **AND** it SHALL expose `Discard change` with destructive visual semantics
- **AND** it SHALL NOT expose Unstage for that unstaged row.

#### Scenario: disabled mutation row does not expose Git mutations

- **WHEN** a changed-file row is diff-only, `mutationDisabled`, stale, or has no available mutation callback
- **THEN** the system SHALL prevent the WebView native context menu
- **AND** it SHALL NOT expose Stage, Unstage, or Discard actions.

#### Scenario: opening a menu is presentation-only

- **WHEN** the user opens, navigates, dismisses, or cancels a changed-file context menu
- **THEN** the system SHALL NOT open the file, change commit inclusion, collapse a section, or refresh Git status
- **AND** it SHALL NOT execute a mutation until the user activates a concrete menu item.

#### Scenario: topology changes invalidate an open file menu

- **WHEN** the workspace, repository status topology, file section, mutation availability, or scoped callback changes while a changed-file context menu is open
- **THEN** the system SHALL close that file context menu
- **AND** the stale menu action SHALL NOT remain activatable against its previous target.

### Requirement: Git Diff File Context Actions MUST Preserve Repository And Section Scope

Every Git Diff file context action MUST target the clicked row's workspace, explicit repository identity, section, normalized repository-relative path, and operation. Context-menu actions SHALL reuse existing mutation, confirmation, and refresh paths instead of invoking a parallel Git service flow.

#### Scenario: same relative path in two repositories stays isolated

- **WHEN** two repository groups contain the same repository-relative path
- **AND** the user activates a context action on the second repository's row
- **THEN** the mutation callback MUST receive the second row's `repositoryRoot + path`
- **AND** it MUST NOT mutate the first repository.

#### Scenario: workspace-root repository identity remains explicit

- **WHEN** a multi-repository row belongs to `repositoryRoot === ""`
- **THEN** its context action MUST preserve the empty string as explicit workspace-root identity
- **AND** it MUST NOT fall back to a configured nested repository.

#### Scenario: same path in staged and unstaged sections follows clicked section

- **WHEN** the same path has staged and unstaged evidence
- **AND** the user opens the context menu on one section's row
- **THEN** the action matrix MUST be derived from the clicked section
- **AND** path-only matching MUST NOT expose operations from the sibling section.

#### Scenario: single repository bulk target remains section-local

- **WHEN** multiple selected rows include the context-menu target
- **THEN** a bulk context action MUST include only mutation-enabled selected paths from the clicked section
- **AND** it MUST NOT mutate selected paths from another section or repository.

#### Scenario: discard reuses confirmation and refresh

- **WHEN** the user activates Discard from an unstaged file context menu
- **THEN** the existing destructive confirmation dialog SHALL open before mutation
- **AND** cancel SHALL perform zero mutations
- **AND** confirm SHALL execute the existing current-repository or explicit-repository revert path
- **AND** a successful multi-repository revert SHALL refresh aggregate repository status exactly once.

#### Scenario: multi repository stage and unstage refresh once

- **WHEN** a multi-repository Stage or Unstage context action succeeds
- **THEN** the existing scoped mutation callback SHALL receive `repositoryRoot + path`
- **AND** the aggregate repository status refresh callback SHALL run exactly once.
