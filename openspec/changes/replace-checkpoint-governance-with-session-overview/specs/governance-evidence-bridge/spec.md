# governance-evidence-bridge Spec Delta

## MODIFIED Requirements

### Requirement: Governance Evidence Consumption MUST Default To Advisory Semantics

The system MUST treat all harness governance evidence consumed by the bridge, existing and new, as advisory by default. Missing artifacts, stale artifacts, malformed advisory reports, platform qualifiers, spec warnings, large-file near-threshold findings, and heavy-test-noise warnings MUST remain visible as governance evidence without automatically creating a blocking checkpoint verdict. Governance evidence MUST only participate in checkpoint verdict computation while the governance evidence surface is opted in; when the surface is disabled, the checkpoint verdict MUST be derived exclusively from in-session signals.

#### Scenario: disabled surface decouples governance from verdict

- **WHEN** the governance evidence visibility control is off
- **THEN** the checkpoint view model MUST receive a null governance snapshot
- **AND** the checkpoint verdict MUST NOT be influenced by any governance evidence, including cost-budget derived evidence

#### Scenario: missing governance artifact remains advisory

- **WHEN** a governance artifact is missing from the workspace
- **THEN** the evidence bridge MUST emit degraded or unknown evidence with a documented degradation reason
- **AND** the emitted evidence MUST NOT by itself force a `blocked` checkpoint verdict

#### Scenario: stale governance artifact remains visible without blocking

- **WHEN** an artifact-backed governance evidence item is stale
- **THEN** the evidence bridge MUST preserve the evidence source, observed time, and stale reason
- **AND** consumers MUST be able to render the stale state as an advisory signal
- **AND** the stale state MUST NOT by itself force a `blocked` checkpoint verdict

#### Scenario: advisory evidence keeps provenance

- **WHEN** governance evidence is rendered as an advisory signal
- **THEN** the evidence MUST still expose source identity and available provenance such as observed time, artifact path, artifact hash, and qualifier
- **AND** the UI MUST NOT hide provenance merely because the signal is non-blocking
