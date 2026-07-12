## MODIFIED Requirements

### Requirement: Sidebar Last-Good Snapshot MUST Be Persisted Per Engine Source

Sidebar hydration MUST maintain snapshot health and continuity eligibility independently for each engine/source across staged and background refreshes.

#### Scenario: healthy engine snapshot advances during another engine's degraded hydration

- **WHEN** one engine returns partial or timeout evidence during staged hydration
- **AND** another engine returns healthy current rows
- **THEN** the healthy engine snapshot MUST be updated independently
- **AND** the degraded engine MUST NOT make the entire workspace snapshot ineligible

#### Scenario: authoritative removal is applied before continuity seed

- **WHEN** archive, delete, hidden, or out-of-scope evidence is authoritative for a row
- **THEN** that evidence MUST be applied before any engine-specific last-good seed
- **AND** staged hydration MUST NOT resurrect the row

