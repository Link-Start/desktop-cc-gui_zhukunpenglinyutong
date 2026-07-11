## MODIFIED Requirements

### Requirement: Workspace Session Catalog SHALL Avoid Unbounded First-Page Loads

Workspace session catalog and sidebar consumers SHALL treat the first page as a bounded projection rather than an all-history completeness proof.

#### Scenario: sidebar first paint uses a bounded request

- **WHEN** sidebar hydration requests the first workspace session page
- **THEN** the request MUST use a documented bounded page size
- **AND** it MUST NOT use a sentinel limit to force exhaustive history before first paint
- **AND** the response MUST retain a stable continuation cursor or explicit partial/degraded evidence when more history may exist

#### Scenario: load older preserves the original query contract

- **WHEN** the user loads an additional page after applying workspace scope, attribution mode, keyword, engine, or status filters
- **THEN** the continuation request MUST preserve those query dimensions
- **AND** merged rows MUST remain stably ordered and deduplicated
- **AND** a late page from an older query MUST NOT replace the current projection

#### Scenario: bounded absence is not authoritative deletion

- **WHEN** a bounded first page omits a previously visible in-scope session
- **AND** source completeness is partial, capped, timed out, or otherwise degraded
- **THEN** consumers MUST NOT remove the last-good row solely because of the omission
- **AND** authoritative archived, deleted, hidden, or out-of-scope evidence MUST still remove it

