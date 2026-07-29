## ADDED Requirements

### Requirement: Context Artifact Integrity MUST Bind The Stored Payload

Context Artifact Store MUST checksum the deterministic serialized package payload and MUST recompute that checksum on every read. A mismatch MUST fail closed.

#### Scenario: Stored package payload is modified
- **WHEN** any stored Context Package field changes without a matching payload checksum
- **THEN** artifact retrieval fails with an integrity error and does not return the package

### Requirement: Context Artifact Publish MUST Be Cross Platform And Race Safe

Context Artifact Store MUST publish complete files atomically on macOS, Windows and Linux, MUST NOT depend on opening directories on unsupported platforms, and MUST validate an existing winner after concurrent publication.

#### Scenario: Concurrent writers publish the same artifact
- **WHEN** two writers race to publish the same content-addressed artifact
- **THEN** both callers observe one complete checksum-valid artifact and no partial temp artifact is accepted
