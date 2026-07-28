# shared-context-artifact-retrieval Specification

## Purpose
TBD - created by archiving change add-shared-context-compiler. Update Purpose after archive.
## Requirements
### Requirement: Context Artifact Store MUST Commit Atomically

The system MUST persist large context payloads and retrievable omissions using temp-file, sync, and atomic rename under workspace/session ownership with checksum metadata.

#### Scenario: interrupted write is not visible

- **WHEN** the process stops before atomic rename
- **THEN** no completed ArtifactRef MUST point to the partial file
- **AND** startup orphan scan MUST identify the temporary file without deleting referenced artifacts

#### Scenario: checksum mismatch fails closed

- **WHEN** stored artifact bytes do not match the expected checksum
- **THEN** retrieval MUST return a typed integrity error
- **AND** it MUST NOT return corrupted content or regenerate the same operation from drifting source

### Requirement: Progressive Retrieval MUST Preserve Permission And Control Boundaries

Artifact retrieval MUST require matching workspace, shared session, artifact id, and checksum. Returned content MUST be marked reference-only and MUST never execute historical control semantics.

#### Scenario: cross-session retrieval is denied

- **WHEN** a caller requests an artifact owned by another workspace or shared session
- **THEN** retrieval MUST fail with an ownership error
- **AND** artifact content MUST not be disclosed

#### Scenario: historical control remains inert

- **WHEN** retrieved content contains a historical stop, compact, approval, or tool-control message
- **THEN** the response MUST mark it as reference context
- **AND** no current runtime control action MUST be triggered
