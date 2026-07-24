## ADDED Requirements

### Requirement: Git History title layer hosts document tabs

The Git History panel SHALL expose an accessible document tab strip in its integrated title layer with one pinned Git Graph tab and zero or more closable File History tabs.

#### Scenario: Tabs share the existing Git Graph toolbar row
- **WHEN** the Git History panel renders document tabs
- **THEN** the tab strip SHALL render inside the existing Git Graph toolbar row together with project, repository, branch, status, and panel actions
- **AND** the system MUST NOT add a second standalone title or tab row above that toolbar

#### Scenario: Git Graph tab is pinned
- **WHEN** the Git History panel opens
- **THEN** the first tab SHALL represent Git Graph
- **AND** it SHALL render as an icon-only compact tab with an accessible name and tooltip
- **AND** it MUST remain available and MUST NOT expose a close action

#### Scenario: File History tabs use compact file chrome
- **WHEN** one or more File History tabs render
- **THEN** each tab SHALL reuse the shared file-type icon, show only the basename as its visible label, and expose the full display path through its accessible name and tooltip
- **AND** the compact close action SHALL remain geometrically centered
- **AND** tab width SHALL fit its content up to a bounded maximum instead of reserving a fixed wide slot

#### Scenario: File History tab context menu closes scoped tabs
- **WHEN** user opens the context menu on a File History tab
- **THEN** the menu SHALL offer Close, Close Others, and Close All actions using the shared renderer context menu
- **AND** Close SHALL remove only the invoked target while preserving inactive-tab semantics and active-tab neighbor fallback
- **AND** Close Others SHALL retain and activate only the invoked target
- **AND** Close All SHALL clear every File History tab and activate the pinned Git Graph tab
- **AND** the pinned Git Graph tab MUST NOT expose this close menu

#### Scenario: Multiple file history tabs remain independently addressable
- **WHEN** users open different file history targets
- **THEN** each distinct `workspaceId + repositoryRoot + path` identity SHALL appear as a separate closable tab
- **AND** each tab label SHALL expose its file display path without merging same-named files from different repositories or workspaces

#### Scenario: Duplicate file target focuses the existing tab
- **WHEN** a File History target whose identity is already open is requested again
- **THEN** the panel SHALL activate the existing tab
- **AND** MUST NOT append a duplicate tab

#### Scenario: Active tab controls the visible workspace
- **WHEN** the active tab is Git Graph
- **THEN** the existing branch, commit, details, worktree and operation surfaces SHALL render unchanged
- **WHEN** the active tab is a File History target
- **THEN** exactly that target's File History workspace SHALL render inside the Git History body

#### Scenario: Tab semantics are accessible
- **WHEN** the title tab strip renders
- **THEN** it SHALL expose `tablist`, `tab`, and active `tabpanel` semantics
- **AND** each File History close action SHALL have a target-specific accessible name

#### Scenario: Narrow title layer preserves access to tabs
- **WHEN** open tabs exceed the available title width
- **THEN** the tab strip SHALL remain usable through horizontal overflow
- **AND** project/repository controls and the panel close action MUST remain reachable
