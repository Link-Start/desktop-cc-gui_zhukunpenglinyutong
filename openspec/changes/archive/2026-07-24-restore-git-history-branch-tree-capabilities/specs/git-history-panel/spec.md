## ADDED Requirements

### Requirement: Git History repository branch tree preserves navigation and status affordances

The shared single/multi-repository branch tree SHALL preserve the complete navigation and branch-status affordances of the Git History navigator within each repository scope.

#### Scenario: All branches remains selectable within the active repository

- **WHEN** Git History renders a repository branch tree with an active repository
- **THEN** the navigator SHALL expose an `All Branches` entry
- **AND** selecting it SHALL load all branches for that active `repositoryRoot`
- **AND** it SHALL NOT aggregate commit history across repositories

#### Scenario: Useful local groups expand by default

- **WHEN** a repository catalog contains a local root group or a current local branch group
- **THEN** the local root group SHALL be expanded by default
- **AND** the current branch group SHALL be expanded by default
- **AND** repository/group identities SHALL remain isolated across repositories

#### Scenario: Local branch rows expose complete status affordances

- **WHEN** a local branch row is visible
- **THEN** a current branch SHALL use the current-branch emphasis and expose `HEAD`
- **AND** recognized `main`, `master`, or `zh` branch leaves SHALL expose their localized special badge
- **AND** positive `ahead` or `behind` values SHALL render signed count badges
- **AND** zero values SHALL NOT render empty count badges

#### Scenario: Remote branch rows preserve special branch identity

- **WHEN** a remote branch row for a recognized `main`, `master`, or `zh` branch leaf is visible
- **THEN** it SHALL expose the localized special badge
- **AND** selection/context actions SHALL retain the complete remote branch name
