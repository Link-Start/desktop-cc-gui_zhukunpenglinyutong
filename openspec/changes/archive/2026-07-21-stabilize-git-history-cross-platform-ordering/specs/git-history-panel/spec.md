## MODIFIED Requirements

### Requirement: Git History multi-repository branch navigator preserves repository identity

When a workspace contains multiple Git repositories, Git History SHALL replace the single-repository branch navigator with a complete local/remote repository tree while preserving exact repository scope for branch selection and downstream history surfaces.

#### Scenario: Multi-repository tree renders complete repository groups

- **WHEN** Git History receives more than one repository summary
- **THEN** the left navigator SHALL render local and remote sections
- **AND** each section SHALL expose every discovered repository as an independently expandable row
- **AND** repository rows SHALL use deterministic visually distinct color slots without replacing repository name semantics
- **AND** color collision resolution SHALL produce the same repository-to-slot mapping on Windows, macOS, and Linux regardless of host locale or input array order
- **AND** the redundant top-toolbar repository picker SHALL NOT render

#### Scenario: Multiple repositories expand independently

- **WHEN** the user expands repository rows under local or remote sections
- **THEN** each row SHALL preserve its own expanded state
- **AND** multiple repositories SHALL remain expanded simultaneously
- **AND** local rows SHALL show only repository-scoped local branches while remote rows SHALL show only repository-scoped remote branches

#### Scenario: Repository branches preserve collapsible Git scopes

- **WHEN** an expanded repository contains local branches with and without `/` prefixes
- **THEN** local branches SHALL be grouped into a localized root group and first-segment prefix groups
- **AND** the current local branch group SHALL be expanded by default
- **WHEN** an expanded repository contains remote branches
- **THEN** remote branches SHALL be grouped by remote name
- **AND** group and branch ordering SHALL be locale-independent and identical on Windows, macOS, and Linux
- **AND** each group SHALL preserve independent expanded state scoped by repository and local/remote section
- **AND** branch leaves SHALL display the scoped leaf label while selection and context actions retain the complete branch name
- **AND** search SHALL temporarily expand matching groups without replacing stored expansion state

#### Scenario: Scoped branch selection updates the full Git History surface

- **WHEN** the user selects a branch nested under a repository row
- **THEN** Git History SHALL select that exact `repositoryRoot` and branch name
- **AND** the commit graph, worktree surface, commit details, and subsequent Git actions SHALL use the selected repository scope

#### Scenario: Repository branch discovery partially fails

- **WHEN** branch discovery fails for one repository while other repository reads settle successfully
- **THEN** the failed repository SHALL expose a row-local error state
- **AND** successful repositories SHALL remain expandable, searchable, and selectable

#### Scenario: Multi-repository search preserves scoped results

- **WHEN** the user searches by repository display name or branch name
- **THEN** the tree SHALL show matching repositories and matching scoped branches
- **AND** matching local/remote sections, repository rows, and branch groups SHALL temporarily expand without replacing stored expansion state
- **AND** selecting a search result SHALL retain the result repository's exact identity

#### Scenario: Single-repository workspace uses the shared repository tree

- **WHEN** Git History receives exactly one repository summary
- **THEN** the navigator SHALL render the same local/remote repository tree used by multi-repository workspaces
- **AND** each local/remote section SHALL expose exactly one repository row
- **AND** a `null` selected repository SHALL resolve to the sole repository identity, including an empty-string `repositoryRoot`
- **AND** the redundant top-toolbar repository picker SHALL NOT render
- **AND** branch selection and branch context actions SHALL retain existing single-repository Git command semantics

#### Scenario: Repository discovery has no rows

- **WHEN** Git History receives no repository summaries
- **THEN** it SHALL retain the legacy branch navigator as a compatibility fallback
