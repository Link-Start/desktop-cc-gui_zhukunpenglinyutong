## ADDED Requirements

### Requirement: Branch management preserves repository scope

Branch list, checkout, create, and update operations SHALL preserve the caller's explicit repository scope while maintaining legacy configured-root compatibility.

#### Scenario: Explicit repository branch list
- **WHEN** the caller requests branches with a repository root
- **THEN** local branches, remote branches, current branch, upstream, and ahead/behind SHALL describe that repository only

#### Scenario: Explicit repository checkout or create
- **WHEN** the caller checks out or creates a branch with a repository root
- **THEN** the mutation SHALL affect only that repository
- **AND** sibling repository HEAD and working tree state SHALL remain unchanged

#### Scenario: Legacy caller omits repository root
- **WHEN** an existing caller omits repository root
- **THEN** the command SHALL continue resolving the configured workspace Git root

#### Scenario: Scoped branch update
- **WHEN** Update is invoked for a current or non-current branch in a selected repository
- **THEN** upstream validation and update behavior SHALL use that repository only

### Requirement: Compact branch surfaces consume rich branch metadata

Compact branch surfaces SHALL preserve the rich branch metadata returned by the backend instead of reducing it to a flat legacy branch array.

#### Scenario: Local and remote hierarchy
- **WHEN** branch details load successfully
- **THEN** local branches SHALL appear before remote branches
- **AND** remote branches SHALL be grouped by remote and branch path segments

#### Scenario: Tracking state is available
- **WHEN** a local branch has upstream tracking
- **THEN** the row SHALL show upstream plus ahead and behind indicators

#### Scenario: Recent branches are displayed
- **WHEN** local branch timestamps are available
- **THEN** recent branches SHALL be derived from local branch metadata without a separate backend scan

#### Scenario: Branch section labels are unambiguous
- **WHEN** recent shortcuts, the complete local list, and remote branches are rendered together
- **THEN** they SHALL use distinct Recent, Local, and Remote headings
- **AND** an intentional branch appearing in both Recent and Local SHALL NOT be presented as two identical unnamed sections

### Requirement: Compact branch update exposes operation progress and result

The compact branch surface SHALL expose Update progress and the structured backend result instead of silently discarding it.

#### Scenario: Update is pending
- **WHEN** Update has been selected and its request has not settled
- **THEN** the action SHALL show a loading indicator and reject duplicate activation

#### Scenario: Update settles
- **WHEN** Update returns success, no-op, blocked, or error
- **THEN** the surface SHALL show a readable outcome
- **AND** branch and repository summaries SHALL refresh after a settled mutation result
