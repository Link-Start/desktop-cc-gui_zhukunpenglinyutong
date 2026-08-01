## ADDED Requirements

### Requirement: Workspace-scoped multi-repository branch actions
The multi-repository Git command center MUST expose workspace-scoped Update All and Checkout All Branch actions above repository rows while preserving explicit repository identity for every mutation.

#### Scenario: Multi-repository root actions are visible
- **WHEN** the command center root view contains more than one repository summary
- **THEN** it SHALL render keyboard-accessible Update All and Checkout All Branch actions before repository rows
- **AND** repository icons SHALL use deterministic, visually distinct color slots within the supported palette
- **AND** icon color SHALL NOT replace repository name or Git status semantics
- **AND** single-repository mode SHALL retain its existing repository-scoped action layout

#### Scenario: Update all repositories
- **WHEN** the user selects Update All
- **THEN** the client SHALL sequentially invoke the existing scoped branch update for every repository that has a current branch
- **AND** each invocation MUST use that repository's exact `repositoryRoot` and current branch
- **AND** repositories without a current branch SHALL be reported as skipped without a mutation call

#### Scenario: Discover common branches
- **WHEN** the user selects Checkout All Branch
- **THEN** the client SHALL list branches using every repository's exact `repositoryRoot`
- **AND** it SHALL present local branch names and exact remote refs that exist in at least two successfully loaded repositories
- **AND** each candidate SHALL identify its eligible repositories and coverage count against the total repository count
- **AND** local and remote candidates SHALL remain separate groups

#### Scenario: Common branch discovery partially fails
- **WHEN** one or more scoped branch-list requests reject
- **THEN** the client SHALL identify the repositories whose branches could not be loaded
- **AND** it SHALL continue presenting candidates shared by at least two successfully loaded repositories
- **AND** failed repositories SHALL NOT be treated as eligible for any candidate

#### Scenario: Checkout one common branch across repositories
- **WHEN** the user selects a discovered common local branch or exact remote ref
- **THEN** the client SHALL sequentially invoke the existing scoped checkout for every discovered repository
- **AND** each invocation MUST use the selected candidate's eligible repository roots and branch target
- **AND** repositories outside the selected candidate coverage SHALL be reported as skipped without a mutation call

#### Scenario: One repository mutation fails
- **WHEN** one scoped Update or Checkout rejects
- **THEN** the client SHALL record that repository as failed and continue remaining repositories
- **AND** the final feedback SHALL distinguish success, failure, and skipped counts
- **AND** it SHALL identify failed repositories without exposing secrets

#### Scenario: Batch action is already pending
- **WHEN** the user attempts to trigger another workspace-scoped branch action while one is running
- **THEN** duplicate execution SHALL be ignored
- **AND** the command center SHALL expose an accessible pending state

#### Scenario: Batch action settles
- **WHEN** all eligible repository operations have settled
- **THEN** repository summaries and visible branch state SHALL refresh through existing refresh paths
- **AND** no new polling loop or backend batch command SHALL be introduced
