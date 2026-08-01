# conversation-presentation-context-normalization Specification

## Purpose
定义 conversation message 在 realtime、history 与 messages rendering 之间共享的 producer-neutral presentation metadata contract，确保历史兼容、展示等价与 row/presentation 依赖边界长期可验证。
## Requirements
### Requirement: Conversation messages expose neutral presentation metadata

Message conversation items MUST support optional `MessagePresentationMetadata` containing display text、sticky candidate text and a
producer-neutral discriminated context union. Raw transport fields MUST remain available during migration.

#### Scenario: normalized message carries producer-neutral contexts

- **WHEN** a user message contains browser、intent-canvas、memory or note-card context
- **THEN** its presentation metadata contains only neutral renderer fields
- **AND** producer-specific transport payloads are not required by row presentation

### Requirement: Realtime and history normalization are presentation-equivalent

Realtime assembly and supported history loaders MUST produce equivalent presentation metadata for semantically identical messages.

#### Scenario: equivalent raw sources converge

- **WHEN** realtime and restored history represent the same injected context and visible user input
- **THEN** display text、sticky candidate text and normalized contexts are equal

#### Scenario: image-only user message remains renderable

- **WHEN** a user message has images but no visible text after context suppression
- **THEN** metadata preserves an empty display text while the conversation summary remains renderable from image count

### Requirement: Legacy history uses one compatibility adapter

Messages presentation MUST prefer normalized metadata and MAY parse raw legacy history only through one compatibility adapter.

#### Scenario: legacy item lacks metadata

- **WHEN** a restored message contains only legacy injected text
- **THEN** the compatibility adapter derives the same neutral metadata as the normalized boundary path
- **AND** row components do not parse the producer grammar themselves

### Requirement: Messages row presentation is producer-independent

Messages row/presentation modules MUST NOT directly import parser implementations from browser-agent、intent-canvas、project-memory or
note-cards.

#### Scenario: producer grammar changes

- **WHEN** a producer changes its raw attachment or injected prompt parser
- **THEN** only ingestion/history normalization and its tests require updates
- **AND** messages row presentation continues consuming the neutral contract
