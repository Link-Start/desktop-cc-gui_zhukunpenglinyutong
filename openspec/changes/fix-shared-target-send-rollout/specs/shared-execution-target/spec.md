## ADDED Requirements

### Requirement: Selected Next Target MUST Survive Shared Session Reload

The Shared Session metadata MUST persist the complete selected next Execution Target, including engine, provider profile identity, model, reasoning, and readable provider snapshot fields. Loading the Shared Session MUST restore that target into `selectedNextTarget`. Legacy metadata that lacks optional target fields MUST remain readable without inventing values.

#### Scenario: sent managed target survives reload

- **WHEN** a user sends a Turn using a Shared target containing CLI, managed Provider, Model, and Reasoning and later reloads the Shared Session
- **THEN** the composer MUST restore the same complete `selectedNextTarget`
- **AND** the next send MUST use that restored target unless the user changes it

#### Scenario: legacy partial target remains compatible

- **WHEN** a legacy Shared Session contains only Engine or Engine plus Provider in `selectedTarget`
- **THEN** the session MUST load successfully
- **AND** missing Model, Reasoning, or readable snapshot fields MUST remain absent rather than being guessed

### Requirement: Selection Provider Source MUST Convert To Canonical Source At Freeze Boundary

The system MUST keep Provider catalog selection source separate from canonical snapshot source.
Provider catalog and mutable `selectedNextTarget` MAY use the selection-domain source
`"disk" | "managed"`. `TurnExecutionSnapshot` and canonical Shared facts MUST use the
Foundation source `"local" | "managed"`. The system MUST perform this conversion exactly once
while freezing the Turn snapshot. Canonical IPC and storage MUST reject `"disk"` and unknown
source values rather than silently normalizing them.

#### Scenario: local selection freezes canonical local source

- **WHEN** a Shared Turn freezes a local/default selection whose catalog source is `"disk"`
- **THEN** its `TurnExecutionSnapshot.providerProfileSource` MUST be `"local"`
- **AND** the canonical `conversation.turnRequested` fact MUST pass schema validation

#### Scenario: managed selection preserves managed source

- **WHEN** a Shared Turn freezes a managed Provider selection
- **THEN** its canonical source MUST remain `"managed"`
- **AND** Provider identity, Model, and Reasoning MUST remain unchanged

#### Scenario: invalid canonical source fails closed

- **WHEN** canonical IPC or event validation receives `"disk"` or an unknown
  `providerProfileSource`
- **THEN** the payload MUST be rejected before runtime side effects
- **AND** the canonical schema MUST NOT be widened to accept the selection-domain value

### Requirement: New Shared Session MUST Start With A Complete Execution Target

A newly created Shared Session MUST persist a complete resolved `initialTarget` before it becomes
visible. The target MUST include Engine, Provider semantics, `modelCatalogEntryId`, runtime
`model`, and a readable Provider snapshot. `selectedEngine` MAY remain as a legacy rollback
mirror, but MUST be derived from `initialTarget.engine`; it MUST NOT be an independent creation
authority. Legacy partial metadata MAY remain readable, but MUST NOT define the creation contract
for new sessions.

#### Scenario: complete initial target is persisted atomically

- **WHEN** a user creates a Shared Session with a resolved local or managed Target
- **THEN** the first persisted metadata MUST contain that complete Target
- **AND** the returned Session and Composer MUST expose the same Engine, Provider, catalog model,
  runtime model, and readable snapshot
- **AND** no Runtime Binding or canonical Turn fact may be created by Session creation

#### Scenario: missing or partial initial target fails before creation

- **WHEN** a caller omits `initialTarget` or supplies only Engine/Provider without the required
  catalog/runtime model pair and readable Provider snapshot
- **THEN** Session creation MUST fail with an actionable invalid-target error
- **AND** no Shared Session directory, metadata row, Binding, or Turn fact may be created

#### Scenario: selected engine conflicts with initial target

- **WHEN** a compatibility caller supplies `selectedEngine` that differs from
  `initialTarget.engine`
- **THEN** Session creation MUST fail closed
- **AND** the system MUST NOT silently choose either value

### Requirement: Shared Target Selection MUST Have One Complete Authority

The Shared Composer MUST expose only the complete CLI → Provider → Model → Reasoning selector.
An Engine-only selector or callback MUST NOT be reachable on a Shared Session. A selected Target
MUST be persisted successfully before it is published to the in-memory `selectedNextTarget`
store. Persistence failure MUST keep the previous Target visible and effective.

#### Scenario: CLI switch uses the complete target selector

- **WHEN** a user changes CLI in a Shared Session
- **THEN** the change MUST resolve and persist a complete Target through the four-level selector
- **AND** no Engine-only action may replace the existing Target with a partial value

#### Scenario: selection persistence fails

- **WHEN** persisting a newly selected Target fails
- **THEN** the Composer MUST keep the previous durable Target selected
- **AND** it MUST surface a readable error
- **AND** a later send MUST NOT use the unpersisted Target

## MODIFIED Requirements

### Requirement: Frozen Model Identity MUST Separate Catalog And Runtime Values

Every new Shared Turn target MUST freeze both `modelCatalogEntryId` and runtime `model` when a
catalog entry is selected. The backend MUST validate both values against the same
Provider-scoped catalog entry. Runtime adapters MUST consume only runtime `model`; a catalog-only
ID MUST NOT cross the Runtime boundary. Legacy snapshots without `modelCatalogEntryId` MAY be
validated by runtime `model`, but MUST NOT treat a catalog ID as a runtime model.

#### Scenario: catalog id differs from runtime model

- **WHEN** the selected catalog entry has `id != model`
- **THEN** the frozen Turn snapshot MUST preserve both values
- **AND** the CLI request MUST contain only the entry's runtime `model`

#### Scenario: mismatched model pair fails before side effect

- **WHEN** `modelCatalogEntryId` and runtime `model` do not identify the same entry for the
  frozen Engine and Provider
- **THEN** the Turn MUST fail closed before process start, Binding materialization, or prompt send
- **AND** the system MUST NOT substitute a default Provider or Model

### Requirement: Turn Snapshot MUST Be The Sole Runtime Authority

After `conversation.turnRequested` is durably appended, every operation for that attempt MUST
derive Engine, Provider, Model, and Reasoning from the persisted snapshot. Frontend or legacy flat
Target fields MUST NOT override the snapshot. Picker changes after freeze MUST affect only the
next Turn.

#### Scenario: stale legacy fields disagree with durable snapshot

- **WHEN** a durable attempt snapshot selects Target A while stale legacy fields contain Target B
- **THEN** Runtime dispatch, Binding, Context Delivery, terminal commit, and badge MUST all use
  Target A
- **AND** Target B MUST cause no Runtime side effect

#### Scenario: changing picker does not rewrite history

- **WHEN** the user changes `selectedNextTarget` after an earlier Turn was requested
- **THEN** the earlier Turn's Runtime owner and visible label MUST remain bound to its immutable
  snapshot

### Requirement: Explicit local target MUST freeze canonical Provider semantics

The system MUST treat an Execution Target with no Provider Profile ID as explicit local/default
execution.
At the send/freeze boundary, the mutable selection source `"disk"` MUST be converted to
canonical `providerProfileSource = "local"` and persisted with a readable local Provider name.
This normalization MUST NOT apply to legacy Turns whose execution target is unknown.

#### Scenario: new local Turn reloads as local configuration

- **WHEN** a new Shared Turn is sent with no Provider Profile ID
- **THEN** its frozen canonical snapshot MUST identify local Provider semantics with
  `providerProfileSource = "local"`
- **AND** realtime and history badges MUST display “本地配置” rather than “历史配置未知”

#### Scenario: unknown legacy identity remains unknown

- **WHEN** a legacy Turn lacks both explicit local/default semantics and Provider identity
- **THEN** history MUST keep the unknown-history label
- **AND** MUST NOT fabricate local Provider semantics

## RENAMED Requirements

- FROM: `### Requirement: Explicit local target MUST freeze disk Provider semantics`
- TO: `### Requirement: Explicit local target MUST freeze canonical Provider semantics`
