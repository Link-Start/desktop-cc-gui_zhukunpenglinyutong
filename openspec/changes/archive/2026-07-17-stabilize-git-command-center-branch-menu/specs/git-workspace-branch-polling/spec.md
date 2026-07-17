## ADDED Requirements

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
