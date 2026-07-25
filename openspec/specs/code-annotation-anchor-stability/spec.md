# code-annotation-anchor-stability Specification

## Purpose
TBD - created by archiving change stabilize-code-annotation-anchors. Update Purpose after archive.
## Requirements
### Requirement: Code annotations MUST persist a versioned exact anchor

New code annotations MUST persist the selected code snapshot, bounded surrounding context,
and a deterministic fingerprint. The anchor MUST remain optional when reading legacy
annotations.

#### Scenario: Create an annotation from a file selection

- **WHEN** a user confirms an annotation for a valid line range
- **THEN** the selection contains a versioned anchor derived from current file content
- **AND** the selected snapshot uses normalized logical line endings

### Requirement: Anchor relocation MUST be bounded and exact

The client MUST first verify the original line range, then search no more than 120 lines
before or after the original start line. Candidates MUST exactly equal the selected
snapshot. Multiple candidates MUST require a unique context fingerprint match.

#### Scenario: Lines are inserted before annotated code

- **WHEN** the exact selected snapshot moves within the bounded window
- **THEN** the visible annotation uses the relocated line range

#### Scenario: Exact code is ambiguous

- **WHEN** multiple exact candidates exist and context cannot identify one uniquely
- **THEN** resolution returns `stale`
- **AND** the client does not guess a new line range

#### Scenario: Match exists only outside the bounded window

- **WHEN** selected code is found only outside the relocation window
- **THEN** resolution returns `stale`
- **AND** no unbounded scan is performed

### Requirement: Prompt context MUST preserve the selected snapshot

Anchored annotations sent to Composer MUST include the selected code snapshot in addition
to the file line reference and annotation body. Legacy annotations MUST retain their
existing prompt format.

#### Scenario: Send anchored annotation to Composer

- **WHEN** an anchored annotation is appended to a user prompt
- **THEN** the prompt contains its file line reference, annotation body, and exact selected snapshot
