# Delta: git-panel-diff-view

## ADDED Requirements

### Requirement: Compact Vertical Action Column for Commit Composer

The diff panel commit composer SHALL place the AI message generation button and the commit button in a vertical action column on the right side of the commit message textarea, replacing the previous bottom-positioned commit button.

#### Scenario: commit button located in right action column

- **WHEN** the commit composer is visible
- **THEN** the commit button SHALL render below the AI generate button on the right side of the textarea
- **AND** the previous bottom-positioned commit button SHALL NOT be rendered

#### Scenario: commit button states

- **WHEN** there is no commit message, no selected file, or commit is in progress
- **THEN** the commit button SHALL be disabled and show an appropriate tooltip

#### Scenario: multi-repository commit composer uses same layout

- **WHEN** the commit composer is rendered for multiple repositories (`GitMultiRepositoryChanges`)
- **THEN** the AI generate button and commit button SHALL also be placed in the same right-side vertical action column
- **AND** the previous bottom-positioned commit button SHALL NOT be rendered

#### Scenario: commit execution

- **WHEN** user clicks the commit button in the right action column
- **THEN** system SHALL invoke the same `onCommit` callback with `selectedPaths` as before

## REMOVED Requirements

### Requirement: Full-Width Commit Button Below Commit Message Textarea

**Reason**: The full-width commit button below the textarea is replaced by a compact button in the right-side action column to save vertical space and align the AI generate → commit interaction flow.

**Migration**: Users commit from the new right-side column button; behavior is unchanged.
