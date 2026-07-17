## MODIFIED Requirements

### Requirement: Dual List View Modes

The Git panel SHALL keep Diff-specific view actions discoverable from the `Diff`
mode menu without requiring a separate always-visible toolbar row, and SHALL NOT
expose repository switching from that menu.

#### Scenario: repository switcher is hidden from the Diff menu

- **WHEN** the active Git panel mode is `diff`
- **AND** repository scanning is available for the workspace
- **WHEN** the user opens the `Diff` mode menu
- **THEN** the menu SHALL NOT include an action to switch the Git repository used by the Diff panel
- **AND** the existing repository scan, clear, select, and selector-panel contracts SHALL remain available to non-menu callers.

#### Scenario: Git changes section header uses compact neutral controls

- **WHEN** the Git Diff panel renders staged or unstaged changes in flat or tree list mode
- **THEN** the section title SHALL keep staged and unstaged labels in the normal section text color instead of using success/green status color
- **AND** the section count SHALL render with the project shadcn Badge compact secondary treatment
- **AND** the manual refresh action SHALL stay hidden until the section header is hovered or keyboard-focused, matching the section Stage/Unstage action reveal behavior
- **AND** modified file status markers shown as `M` SHALL use the warning/yellow status color rather than the info/blue accent.

## ADDED Requirements

### Requirement: Multi-Repository Change Section Collapse

The multi-repository Diff surface SHALL provide functional staged and unstaged
section collapse controls scoped by workspace identity, repository identity, and section type.
Collapsing a section MUST remain a presentation-only operation.

#### Scenario: collapse one repository section

- **WHEN** the user activates a staged or unstaged section header in a repository group
- **THEN** that section SHALL update its expanded state and hide its file rows
- **AND** the header SHALL expose the current state through `aria-expanded`.

#### Scenario: collapse state is independently scoped

- **WHEN** the user collapses one staged or unstaged section
- **THEN** sections with another type, repository identity, or workspace identity SHALL retain their existing expanded state.

#### Scenario: collapse preserves Git and commit state

- **WHEN** the user collapses or expands a multi-repository section
- **THEN** the operation SHALL NOT change commit selection
- **AND** it SHALL NOT invoke stage, unstage, discard, refresh, or file-open behavior.
