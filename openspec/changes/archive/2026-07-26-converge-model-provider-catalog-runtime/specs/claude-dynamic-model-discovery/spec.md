## ADDED Requirements

### Requirement: Claude Catalog Merge MUST Emit Shared Provenance Metadata

Claude builtin、settings/env and custom model merge MUST retain its existing override behavior while projecting every result through the shared catalog DTO.

#### Scenario: custom model overrides builtin

- **WHEN** a custom or settings model has the same runtime model id as builtin
- **THEN** configured metadata MUST win according to shared precedence
- **AND** the entry MUST identify configured source and provider provenance

#### Scenario: Claude dynamic discovery is unavailable

- **WHEN** no runtime/configured update can be loaded
- **THEN** cached or generated fallback MUST remain deterministic
- **AND** failure MUST not erase user custom models
