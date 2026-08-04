## ADDED Requirements

### Requirement: Live Timeline Updates MUST Preserve A Bounded Parent Render Surface

Conversation streaming MUST keep actual live assistant text progressing without causing equivalent Timeline, overlay, measurement, or scroll state to republish new parent render inputs.

#### Scenario: same live item receives another text delta

- **WHEN** the active assistant item receives a text delta without changing stable history grouping, anchors, boundaries, or row identity
- **THEN** the live row MUST receive the latest visible text
- **AND** stable parent Timeline derivations MUST retain their previous references where their effective values are unchanged.

#### Scenario: overlay calculation produces an equivalent result

- **WHEN** anchor, scroll, resize, measurement, tooltip, or popover calculation produces the same effective state as the previous calculation
- **THEN** the state owner MUST return the previous state reference or skip the write
- **AND** it MUST NOT trigger an unbounded Timeline render loop.

#### Scenario: optional Timeline projections are absent

- **WHEN** no approval or user-input request is visible for the active thread
- **THEN** the parent MUST pass stable `null` projection inputs instead of truthy empty React elements
- **AND** heartbeat changes for an engine without a heartbeat waiting hint MUST NOT invalidate the Timeline memo boundary.

#### Scenario: visible text stalls after ingress

- **WHEN** multiple assistant deltas have arrived for one live item
- **AND** actual rendered visible text has not advanced beyond the configured bounded threshold
- **THEN** the existing evidence-based recovery profile MUST preserve a readable progressive surface
- **AND** the recovery profile MUST bypass a previously starved deferred text snapshot for the live row
- **AND** diagnostics MUST distinguish upstream pending from frontend visible-output stall.
