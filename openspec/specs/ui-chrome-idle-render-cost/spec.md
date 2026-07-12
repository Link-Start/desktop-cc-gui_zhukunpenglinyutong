# ui-chrome-idle-render-cost Specification

## Purpose
TBD - created by archiving change reduce-idle-chrome-render-cost. Update Purpose after archive.
## Requirements
### Requirement: Scrollbar styling SHALL be scoped to scroll roots and opt-in containers

Custom scrollbar styling SHALL be applied to the scroll roots (`html`, `body`) and
to elements that opt in with a `.scrollable` class, and SHALL NOT be applied
through universal `*` / `*:hover` selectors.

#### Scenario: chrome scroll areas keep styled scrollbars
- **GIVEN** the app is running on the desktop webview
- **WHEN** the chat message list, a file-tree scroll container, or a native-overflow settings sub-panel is scrollable
- **THEN** that container SHALL carry the `.scrollable` opt-in and render the styled scrollbar
- **AND** the styled scrollbar SHALL NOT depend on any universal `*` scrollbar selector

#### Scenario: non-opted containers fall back to the platform scrollbar
- **GIVEN** an overflow container that does not carry `.scrollable`
- **WHEN** it becomes scrollable
- **THEN** it SHALL fall back to the platform scrollbar
- **AND** the application SHALL NOT re-introduce a universal `*` scrollbar rule to style it

### Requirement: Workspace diff viewer SHALL unmount while its tab is inactive

The workspace diff viewer SHALL be unmounted when its tab is not the active tab so
that its virtualizer and observers do not run while idle.

#### Scenario: diff viewer releases idle work when hidden
- **GIVEN** the workspace diff viewer tab is not active
- **WHEN** the layout renders
- **THEN** the diff viewer SHALL be unmounted
- **AND** its row virtualizer and per-row observers SHALL NOT run

#### Scenario: transient view state is discarded on tab switch
- **GIVEN** the diff viewer has an unsaved annotation draft, an active selection, or a lazily loaded full-diff
- **WHEN** the user switches away from the diff viewer tab
- **THEN** that transient view state MAY be discarded
- **AND** persisted annotations and the underlying diff SHALL remain intact and reload when the tab is reopened

### Requirement: File tree SHALL virtualize at a low entry threshold

The file tree SHALL virtualize its rows once an entry count threshold of 30 is
reached, rather than rendering every row up to a large threshold.

#### Scenario: medium trees virtualize
- **GIVEN** a file-tree level with 30 or more entries
- **WHEN** the file tree renders
- **THEN** the rows SHALL be virtualized to a scrolling window

#### Scenario: small trees render directly
- **GIVEN** a file-tree level with fewer than 30 entries
- **WHEN** the file tree renders
- **THEN** the rows MAY render without virtualization

