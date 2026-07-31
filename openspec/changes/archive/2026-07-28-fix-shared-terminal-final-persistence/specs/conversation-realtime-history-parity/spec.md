## ADDED Requirements

### Requirement: Shared terminal final MUST cross the durable settlement boundary

When live assistant text is externalized from the root reducer, a Shared Turn's authoritative terminal final MUST be settled into the same assistant item before terminal lifecycle state permits snapshot persistence. Observing one or more streaming deltas MUST NOT be treated as equivalent to observing a completed assistant final.

#### Scenario: streaming prefix is replaced by terminal final
- **WHEN** a Shared Turn emits an assistant streaming prefix and `turn/completed` later carries the complete provider final
- **THEN** the complete final MUST settle the same assistant item exactly once
- **AND** the persisted Shared snapshot MUST contain the complete final rather than the prefix-only shell

#### Scenario: item completion remains idempotent
- **WHEN** a Shared Turn emits both an assistant `item/completed` event and a later `turn/completed` payload with equivalent text
- **THEN** completion tracking MUST keep one assistant final
- **AND** the terminal fallback MUST NOT append a duplicate message

#### Scenario: live text externalization retains its performance boundary
- **WHEN** the assistant emits multiple realtime text deltas before completion
- **THEN** only the existing bounded live-text path MAY process per-delta growth
- **AND** this durability fix MUST NOT restore per-delta root reducer dispatch
