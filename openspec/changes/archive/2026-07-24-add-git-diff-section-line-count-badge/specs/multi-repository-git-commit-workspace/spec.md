# Delta: multi-repository-git-commit-workspace

## ADDED Requirements

### Requirement: Per-repository line-change summary badge

The multi-repository commit workspace SHALL render a `+n-m` line-change summary
badge inside each `git-repository-change-group__header`, visually adjacent to
the existing `filesChanged` count. The badge MUST derive `n` and `m` from the
repository's `totalAdditions` / `totalDeletions` aggregate.

#### Scenario: per-repo header shows total line changes

- **WHEN** a repository group has `totalAdditions` or `totalDeletions` greater
  than zero
- **THEN** the group header SHALL render a `+n-m` badge next to the existing
  file count
- **AND** the badge values SHALL match `status.totalAdditions` and
  `status.totalDeletions`.

#### Scenario: zero-totals hide the per-repo summary badge

- **WHEN** a repository group has both `totalAdditions` and `totalDeletions`
  equal to zero
- **THEN** the group header SHALL NOT render the `+n-m` badge.

#### Scenario: badge uses additive and destructive color tokens

- **WHEN** the per-repo `+n-m` badge renders
- **THEN** the `+n` portion SHALL use the success accent color
- **AND** the `-m` portion SHALL use the destructive accent color
- **AND** the badge SHALL reuse the project's `diff-counts-inline
  git-filetree-badge` visual token family for consistency with per-file
  stats.
