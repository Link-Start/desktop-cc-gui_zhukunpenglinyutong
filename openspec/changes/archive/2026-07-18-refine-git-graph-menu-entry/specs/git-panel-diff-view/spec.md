## ADDED Requirements

### Requirement: Diff mode menu MUST expose one Git Graph history entry

The Git Diff mode menu MUST expose the existing Git History panel through a single `Git Graph` action and MUST keep the legacy `log` mode compatible with non-menu callers.

#### Scenario: menu presents one Git history navigation action

- **WHEN** the user opens the Git Diff mode menu
- **THEN** the menu SHALL show a `Git Graph` action with the `GitCommitHorizontal` icon
- **AND** the menu SHALL NOT show the legacy `Git` (`log`) selectable option

#### Scenario: Git Graph preserves the existing navigation callback

- **WHEN** the user activates the `Git Graph` action
- **THEN** the UI SHALL invoke the existing `onOpenGitHistoryPanel` callback exactly once
- **AND** no Git data operation SHALL be triggered directly by the menu action

#### Scenario: hidden log option remains compatible

- **WHEN** a non-menu caller activates the existing `log` mode
- **THEN** the panel MUST retain its existing `log` mode metadata and render behavior
- **AND** the UI-only menu change MUST NOT remove or alter the `log` mode type, state, callback, or data flow

#### Scenario: Sidebar uses the same Git Graph presentation

- **WHEN** the Sidebar settings menu renders its Git History action
- **THEN** the action SHALL use the `Git Graph` label and `GitCommitHorizontal` icon
- **AND** activating it SHALL preserve the existing `onAppModeChange` and menu-close behavior

#### Scenario: Git Graph quick action is visually emphasized

- **WHEN** the Git Diff mode menu renders the `Git Graph` action
- **THEN** its label SHALL use bold weight and a theme-aware accent color
- **AND** its icon SHALL use the same accent color across normal, hover, focus, and active states
- **AND** adjacent menu items SHALL retain their existing typography and color
