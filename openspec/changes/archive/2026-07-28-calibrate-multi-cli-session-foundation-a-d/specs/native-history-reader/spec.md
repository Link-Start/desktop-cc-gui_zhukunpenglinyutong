## ADDED Requirements

### Requirement: Native History Reader MUST Bound Resource Consumption

Native History Reader MUST reject a source larger than its declared supported byte limit before allocating a source-sized buffer, using a typed error.

#### Scenario: Native history exceeds supported size
- **WHEN** source metadata reports a size above the reader limit
- **THEN** probe/read fails with `source-too-large` without reading the full file

### Requirement: Native History Reader MUST Isolate Provider Private Blocks

Native History Reader MUST allowlist portable text and explicitly supported tool blocks. Provider-private reasoning, signatures, encrypted/redacted blocks and unknown vendor blocks MUST NOT enter normalized entries and MUST be represented as auditable omissions.

#### Scenario: Claude history contains private reasoning
- **WHEN** a Claude source entry contains thinking or signature content
- **THEN** normalized entries exclude that content and the result contains a provider-private omission
