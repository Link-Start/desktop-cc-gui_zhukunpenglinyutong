## MODIFIED Requirements

### Requirement: Claude Sidebar Continuity SHALL Follow Source Completeness

Claude sidebar continuity SHALL treat staged, capped, timeout, startup-only, and otherwise partial hydration as incomplete membership evidence.

#### Scenario: staged hydration preserves last-good Claude rows

- **WHEN** current hydration has not completed authoritative Claude source coverage
- **AND** last-good in-scope Claude rows exist
- **THEN** the sidebar SHALL preserve those rows with degraded or loading evidence
- **AND** omission from the partial result SHALL NOT be treated as deletion
- **AND** authoritative archive, delete, hide, or scope evidence SHALL still remove a row

