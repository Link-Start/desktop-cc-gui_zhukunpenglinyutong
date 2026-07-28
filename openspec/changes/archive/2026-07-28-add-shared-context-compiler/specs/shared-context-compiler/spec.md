## ADDED Requirements

### Requirement: Compiler MUST Select Projection Mode By Capability

The compiler MUST select the first applicable mode in this order: `native-delta`, `native-history-import`, `native-history-clone`, `portable-transcript`, `checkpoint`. Selection MUST use runtime capabilities and destination identity rather than engine-name branches.

#### Scenario: existing binding uses native delta

- **WHEN** destination binding identity is established and delta injection is supported
- **THEN** the compiler MUST select `native-delta`
- **AND** it MUST exclude entries natively owned by that binding

#### Scenario: structured import outranks transcript

- **WHEN** native delta is inapplicable and runtime capability reports structured history import
- **THEN** the compiler MUST select `native-history-import`
- **AND** it MUST NOT choose transcript merely because of engine type

#### Scenario: unsupported capability degrades explicitly

- **WHEN** import and clone are unsupported
- **THEN** the compiler MUST choose portable transcript if safe and within budget, otherwise checkpoint
- **AND** the Manifest MUST record the capability-driven reason

### Requirement: Compatibility Transformer MUST Preserve Semantic Closure

The transformer MUST process thinking, tool ids/results, images, aborted/error turns, provider-private metadata, and historical controls according to target capability.

#### Scenario: tool exchange is atomic

- **WHEN** a tool call and result cross the projection boundary
- **THEN** they MUST be included as a pair with consistently transformed ids or omitted as a pair
- **AND** an orphan call MUST NOT appear as a successful exchange

#### Scenario: private reasoning does not leak

- **WHEN** provider-private reasoning/signature is incompatible with the destination protocol
- **THEN** it MUST be omitted or replaced by a portable semantic block
- **AND** the Manifest MUST record the transformation

#### Scenario: unsupported image becomes artifact reference

- **WHEN** the source contains an image and the target does not support images
- **THEN** the package MUST contain a stable ArtifactRef or explicit not-retrievable omission
- **AND** it MUST NOT silently discard the image

#### Scenario: aborted assistant is not replayed as success

- **WHEN** an assistant block is aborted or failed
- **THEN** it MUST NOT be serialized as a successful assistant conclusion
- **AND** its outcome MUST remain auditable in the package or omission

### Requirement: Compression MUST Be Deterministic And Type-Aware

The compiler MUST apply deterministic category-specific folding for tool output, code/diff, logs, images/attachments, and portable turns. It MUST NOT use nondeterministic or ML compression.

#### Scenario: repeated log folding is stable

- **WHEN** identical repeated log input is compiled multiple times
- **THEN** the folded output and omission record MUST be byte-identical
- **AND** error/warning plus bounded head/tail evidence MUST be retained
