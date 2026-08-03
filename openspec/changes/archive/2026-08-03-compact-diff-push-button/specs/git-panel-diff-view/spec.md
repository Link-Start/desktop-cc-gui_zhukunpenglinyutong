# Delta: git-panel-diff-view

## ADDED Requirements

### Requirement: Compact Push Entry in Diff Panel Toolbar

The diff panel SHALL provide a compact push entry in the header toolbar (same row as the mode selector and refresh button) instead of a full-width push button block above the changes list. The entry SHALL render as an upload icon with a badge showing the number of commits ahead.

#### Scenario: push entry visible with ahead commits

- **WHEN** the panel is in diff mode and `commitsAhead > 0`
- **THEN** the header toolbar SHALL show a push icon button with a badge equal to `commitsAhead`
- **AND** clicking it SHALL invoke the same push action as the previous full-width button

#### Scenario: push entry hidden when nothing to push

- **WHEN** `commitsAhead === 0` or the panel is not in diff mode
- **THEN** the push entry SHALL NOT be rendered

#### Scenario: push error remains visible

- **WHEN** a push action fails
- **THEN** the push error message SHALL still be displayed in the panel even though the full-width push block was removed

#### Scenario: push loading state

- **WHEN** a push is in progress
- **THEN** the toolbar push entry SHALL be disabled and show a loading indicator

## REMOVED Requirements

### Requirement: Full-Width Push Button Block Above Changes List

**Reason**: The full-width `.push-section` push button above the changes list is replaced by the compact toolbar entry to reduce vertical space usage and visual weight.

**Migration**: Users trigger push from the header toolbar icon; behavior (direct `onPush` invocation) is unchanged.
