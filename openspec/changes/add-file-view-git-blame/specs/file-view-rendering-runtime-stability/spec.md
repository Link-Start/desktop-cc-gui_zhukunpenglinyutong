## ADDED Requirements

### Requirement: Disabled Git Blame MUST add no file-open work

The default disabled blame state MUST preserve the existing file rendering and IPC baseline.

#### Scenario: supported file opens with blame disabled
- **WHEN** a supported workspace file enters preview or edit mode and blame has not been enabled
- **THEN** the file view MUST perform no blame-specific IPC or history scan
- **AND** it MUST create no blame gutter DOM or full-file attribution projection

### Requirement: Enabled Git Blame work MUST remain bounded

Blame payload, lookup and rendering MUST use bounded representations appropriate for large files.

#### Scenario: blame contains repeated commit attribution
- **WHEN** adjacent lines belong to the same blame hunk
- **THEN** the backend MUST transmit one compressed hunk rather than duplicate commit metadata for every line
- **AND** the frontend MUST resolve only visible line annotations without mounting one React node per source line

#### Scenario: file exceeds blame budget
- **WHEN** the active file exceeds the supported blame size or line-count budget
- **THEN** the file view MUST decline or degrade blame with an explicit reason
- **AND** it MUST NOT block or discard the file document itself
