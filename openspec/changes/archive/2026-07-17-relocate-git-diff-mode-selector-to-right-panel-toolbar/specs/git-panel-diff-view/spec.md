## ADDED Requirements

### Requirement: Desktop Git Mode Selector SHALL Live In The Right Panel Toolbar

Desktop right panel SHALL render the existing Git mode selector in the toolbar layer when the Git tab is active, without changing the selector's behavior or the responsive panel-tab contract.

#### Scenario: Active Git tab places selector before panel tabs

- **WHEN** the desktop right panel active tab is `git`
- **THEN** the current Git mode selector SHALL render in the `right-panel-toolbar` leading slot
- **AND** the responsive panel tabs SHALL remain in the same toolbar after that slot
- **AND** the Git content area SHALL NOT reserve an empty selector row when no other floating Git action is present.

#### Scenario: Non-Git tab does not retain selector

- **WHEN** the desktop right panel active tab changes from `git` to another tab
- **THEN** the toolbar SHALL NOT retain the Git mode selector or its menu
- **AND** the selected Git mode SHALL remain owned by the existing Git panel state.

#### Scenario: Existing selector capabilities remain unchanged

- **WHEN** the user opens or operates the relocated selector
- **THEN** Diff, Git log, Issues, Pull Requests, flat/tree list view, and Hub actions SHALL invoke their existing callbacks
- **AND** outside click, Escape close with focus restore, configured list-view shortcut, and active-state accessibility semantics SHALL remain available.

#### Scenario: Lazy target fallback preserves reachability

- **WHEN** the Git panel renders before the toolbar mount target is available
- **THEN** the selector SHALL remain available through its existing inline location
- **AND** once the target becomes available the same selector behavior SHALL move to the toolbar without duplicated controls.

#### Scenario: Narrow and swapped desktop layouts remain usable

- **WHEN** the right panel is narrow or the desktop layout is swapped
- **THEN** the selector and responsive panel tabs SHALL remain within the toolbar layout
- **AND** the selector menu SHALL remain visible within the right panel bounds without horizontal overflow or toolbar clipping.

#### Scenario: Worktree action remains independent

- **WHEN** the Git panel exposes a worktree apply action
- **THEN** that action SHALL remain in its existing Git content action row
- **AND** relocating the mode selector SHALL NOT hide, move, or alter the worktree action callback.
