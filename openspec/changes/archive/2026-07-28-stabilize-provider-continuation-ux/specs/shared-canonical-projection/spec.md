## ADDED Requirements

### Requirement: Shared Projection MUST Preserve Frozen Turn Identity

Shared canonical and legacy-compatible projection MUST carry the frozen execution identity from each Turn's authoritative snapshot into every projected assistant message and reload result. Projection MUST NOT substitute the currently selected target, current binding, or engine default for a completed Turn.

#### Scenario: projection rebuild preserves provider identity

- **WHEN** projection cache is deleted and rebuilt for a Shared Session containing Turns from multiple Providers
- **THEN** every rebuilt Turn badge MUST retain its original CLI, Provider, and Model snapshot
- **AND** rebuilt identity MUST match the pre-deletion projection

#### Scenario: live projection and reload agree

- **WHEN** a Turn is first shown from live canonical facts and later shown after application reload
- **THEN** both views MUST render the same frozen execution identity
- **AND** neither view MUST read the current composer target to label that Turn
