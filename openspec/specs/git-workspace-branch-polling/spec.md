# git-workspace-branch-polling Specification

## Purpose
TBD - created by archiving change harden-client-renderer-stability-under-pressure. Update Purpose after archive.
## Requirements
### Requirement: Branch polling MUST validate Git repository state before listing branches
The system SHALL verify that a workspace path is a Git repository before attempting branch list polling.

#### Scenario: workspace is not a Git repository
- **WHEN** the configured workspace path exists but is not a Git repository
- **THEN** the system MUST return a neutral or degraded branch state
- **AND** it MUST NOT repeatedly write `git/branches/list error` for the same non-repository path

#### Scenario: workspace is a Git repository
- **WHEN** the configured workspace path is a valid Git repository
- **THEN** the system MUST continue listing branches through the existing branch state path
- **AND** valid branch data MUST remain available to Git UI surfaces

### Requirement: Branch polling diagnostics MUST preserve real Git failures with dedupe
The system SHALL dedupe repeated branch polling diagnostics without hiding real repository failures.

#### Scenario: repeated identical branch failure occurs
- **WHEN** the same branch polling failure repeats for the same path and reason within the configured window
- **THEN** the system MUST suppress or aggregate duplicate log entries
- **AND** it MUST keep enough metadata to show that polling is degraded

#### Scenario: real repository error occurs
- **WHEN** branch polling fails for a path that is expected to be a Git repository due to permission, corruption, lock, or command failure
- **THEN** the system MUST surface a classified Git diagnostic
- **AND** it MUST NOT downgrade that failure to neutral non-repository state unless repository validation proves the path is not a Git repository

### Requirement: Multi-repository summary refresh is bounded and event-driven

The system SHALL keep repository summary state current through mutation-driven invalidation and a bounded low-frequency fallback.

#### Scenario: Branch mutation invalidates repository state
- **WHEN** checkout, create, update, commit, or push completes
- **THEN** the affected workspace repository summary SHALL be invalidated and refreshed

#### Scenario: Fallback refresh runs
- **WHEN** no mutation invalidation occurs and the relevant UI remains active
- **THEN** fallback summary refresh SHALL run at an interval of at least 30 seconds

#### Scenario: Summary load already in flight
- **WHEN** another fallback or event refresh is requested for the same workspace
- **THEN** the system SHALL deduplicate or supersede the request without applying out-of-order state

#### Scenario: Repository count is large
- **WHEN** bounded discovery finds many repositories
- **THEN** one aggregate bridge response SHALL carry slim summaries
- **AND** frontend SHALL NOT issue per-repository status polling loops

### Requirement: Repository summary fallback SHALL not erase valid branch state on one empty sample

Repository summary refresh SHALL distinguish a transient empty sample from a workspace identity transition so branch state is not erased by a single fallback poll.

#### Scenario: One empty fallback sample follows valid summaries

- **WHEN** a low-frequency refresh returns no summaries after the same workspace previously returned valid repositories
- **THEN** the frontend SHALL preserve the last-known-good repository collection for that sample
- **AND** dependent branch hooks SHALL remain mounted against their selected scope

#### Scenario: Valid replacement summary arrives

- **WHEN** a later refresh returns a valid repository collection
- **THEN** the frontend SHALL converge to the new collection
- **AND** stale-result rejection SHALL continue to prevent older requests from overwriting it

