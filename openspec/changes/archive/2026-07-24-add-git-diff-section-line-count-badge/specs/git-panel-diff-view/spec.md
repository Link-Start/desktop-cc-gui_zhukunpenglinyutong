# Delta: git-panel-diff-view

## ADDED Requirements

### Requirement: Section header line-change summary badge

The single-repository Git Diff panel SHALL render a `+n-m` line-change summary
badge inside each staged and unstaged section header (both flat and tree view),
sitting visually adjacent to the existing file count badge. The badge MUST
aggregate additions and deletions across every file in that section.

#### Scenario: section header shows total line changes

- **WHEN** a staged or unstaged section contains one or more files with
  `additions` / `deletions` numbers
- **THEN** the section header SHALL render a `+n-m` badge where `n` equals the
  sum of `additions` across the section's files and `m` equals the sum of
  `deletions` across the section's files
- **AND** the existing file count badge SHALL continue to render unchanged.

#### Scenario: zero-totals hide the line summary badge

- **WHEN** a section contains files whose aggregated `additions` and
  `deletions` are both zero
- **THEN** the section header SHALL NOT render the `+n-m` badge.

#### Scenario: badge stays visible when section is collapsed

- **WHEN** the user collapses a staged or unstaged section
- **THEN** the `+n-m` badge SHALL remain visible in the header while the file
  rows are hidden.

#### Scenario: badge uses additive and destructive color tokens

- **WHEN** the `+n-m` badge renders
- **THEN** the `+n` portion SHALL use the success accent color
- **AND** the `-m` portion SHALL use the destructive accent color
- **AND** the badge SHALL reuse the project's `diff-counts-inline
  git-filetree-badge` visual token family for consistency with per-file
  stats.
