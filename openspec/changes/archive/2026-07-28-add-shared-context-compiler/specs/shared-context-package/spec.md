## ADDED Requirements

### Requirement: Context Package MUST Be Versioned And Auditable

The system MUST compile Shared canonical entries into `ContextPackage schemaVersion=1` with a deterministic package id, source checksum, destination target, projection manifest, and compression report.

#### Scenario: identical source range compiles identically

- **WHEN** the same canonical source range, destination target, binding identity, capabilities, and budget are compiled twice
- **THEN** both packages MUST have the same package id and source checksum
- **AND** their stable prefix MUST be byte-identical

#### Scenario: package records measured compression

- **WHEN** source content is folded, artifactized, or omitted
- **THEN** `ContextCompressionReport` MUST record source/package token estimates and per-category strategy
- **AND** every lossy operation MUST appear in `ProjectionManifest.omitted`

### Requirement: Projection Manifest MUST Make Omissions Explicit

Every manifest MUST record compiler version, projection mode, included entry ids, typed omissions, disposition, cursor semantics, and source checksum.

#### Scenario: irretrievable omission is visible

- **WHEN** incompatible content cannot be preserved or stored as a retrievable artifact
- **THEN** the omission MUST use `disposition=not-retrievable`
- **AND** Shared send MUST require explicit degraded-context confirmation

#### Scenario: retrievable omission stays reference-only

- **WHEN** omitted content has an ArtifactRef or retrievableRef
- **THEN** the manifest MUST use `disposition=retrievable-on-demand`
- **AND** later packages MUST NOT automatically inline the omitted content

### Requirement: Consecutive Packages MUST Preserve Stable Prefixes

For the same conversation and destination Binding, checkpoint headers and deterministic facts MUST remain byte-stable; new delta facts MUST only append after the stable prefix.

#### Scenario: later handoff appends delta

- **WHEN** a second package adds canonical entries without changing stable facts
- **THEN** the first package stable prefix MUST be an exact byte prefix of the second
- **AND** previously stable sections MUST NOT be reordered or rewritten
