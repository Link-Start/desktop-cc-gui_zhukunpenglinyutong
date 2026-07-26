## ADDED Requirements

### Requirement: Codex Catalog MUST Use Shared Source Precedence And Last-Good Cache

Codex model discovery MUST participate in the shared `runtime > configured > cached > generated fallback` contract and MUST NOT maintain divergent frontend/backend fallback rosters.

#### Scenario: Codex model/list succeeds

- **WHEN** runtime `model/list` returns a valid catalog
- **THEN** runtime facts MUST override generated fallback metadata
- **AND** the validated result MUST become last-good cache

#### Scenario: Codex model/list fails

- **WHEN** runtime refresh fails after a successful catalog
- **THEN** last-good catalog MUST remain available with stale/error metadata
