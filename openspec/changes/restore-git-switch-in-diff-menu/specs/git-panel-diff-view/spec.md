## MODIFIED Requirements

### Requirement: Dual List View Modes

The Git panel SHALL keep Diff-specific mode actions discoverable from the `Diff`
mode menu without requiring a separate always-visible toolbar row.

#### Scenario: repository switcher opens from the Diff menu

- **WHEN** the active Git panel mode is `diff`
- **AND** repository scanning is available for the workspace
- **WHEN** the user opens the `Diff` mode menu
- **THEN** the menu SHALL include an action to switch the Git repository used by the Diff panel
- **AND** selecting that action SHALL open the existing repository selector panel
- **AND** the selector SHALL continue using the existing scan, clear, and select repository behavior.

#### Scenario: Git changes section header uses compact neutral controls

- **WHEN** the Git Diff panel renders staged or unstaged changes in flat or tree list mode
- **THEN** the section title SHALL keep staged and unstaged labels in the normal section text color instead of using success/green status color
- **AND** the section count SHALL render with the project shadcn Badge compact secondary treatment
- **AND** the manual refresh action SHALL stay hidden until the section header is hovered or keyboard-focused, matching the section Stage/Unstage action reveal behavior
- **AND** modified file status markers shown as `M` SHALL use the warning/yellow status color rather than the info/blue accent.
