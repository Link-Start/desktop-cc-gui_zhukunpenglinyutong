## ADDED Requirements

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
