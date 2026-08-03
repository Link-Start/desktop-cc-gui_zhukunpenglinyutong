## ADDED Requirements

### Requirement: Codex Runtime Health Probes MUST NOT Refresh The Model Catalog

Codex runtime health/readiness probes MUST use a supported non-model RPC and MUST NOT call `model/list`. Explicit catalog loading MUST remain owned by the existing model catalog owner, which preserves its in-flight dedupe and last-good or built-in fallback behavior.

#### Scenario: an existing workspace runtime is ensured

- **WHEN** the client checks whether an existing Codex app-server is healthy before reuse
- **THEN** the probe MUST use `collaborationMode/list` or an equivalent supported non-model static RPC
- **AND** it MUST NOT send `model/list`.

#### Scenario: the user or startup owner requests the catalog

- **WHEN** an explicit model catalog load is required
- **THEN** it MUST continue through the existing model catalog owner
- **AND** concurrent consumers MUST reuse that owner's existing in-flight operation
- **AND** failure MUST preserve the last-good catalog or built-in supported fallback.

#### Scenario: Codex emits a periodic upstream refresh timeout

- **WHEN** the Codex app-server's own periodic model refresh worker reports the same timeout repeatedly
- **THEN** the client MUST retain bounded, aggregated diagnostic evidence
- **AND** it MUST NOT claim that changing the health probe disabled or repaired the upstream worker.
