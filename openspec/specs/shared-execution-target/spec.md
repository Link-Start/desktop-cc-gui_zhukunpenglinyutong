# shared-execution-target Specification

## Purpose
TBD - created by archiving change compose-shared-session-execution-target. Update Purpose after archive.
## Requirements
### Requirement: Next Target and Active Turn Target MUST Be Separate Stores

The system MUST maintain two distinct target concepts: `selectedNextTarget` (the mutable composer selection affecting only the next send) and `activeTurnTarget` (the immutable `TurnExecutionSnapshot` captured when a turn attempt is created). The system MUST NOT use the current picker value to annotate in-flight or completed turns.

#### Scenario: picker change does not rewrite active turn badge

- **WHEN** a turn is running with an `activeTurnTarget` snapshot and the user changes the four-level picker
- **THEN** the running turn's badge MUST continue to display the snapshot values
- **AND** the new picker value MUST only affect the next send

#### Scenario: completed turn attribution survives later picker changes

- **WHEN** a turn has completed and the user later changes CLI, provider, model, or reasoning in the picker
- **THEN** the completed turn's attribution MUST remain the original snapshot
- **AND** the picker change MUST NOT create any turn fact or binding

### Requirement: Target Picker MUST Be Four-Level CLI Provider Model Reasoning

The shared session composer MUST expose a four-level execution target picker: CLI (engine), Provider profile, Model, Reasoning. The picker MUST only update `selectedNextTarget`; it MUST NOT create bindings or dispatch turns.

#### Scenario: picker levels are hierarchical

- **WHEN** the user opens the shared session target picker
- **THEN** the picker MUST offer selection in the order CLI → Provider → Model → Reasoning
- **AND** the model catalog MUST be scoped to the selected provider profile

#### Scenario: picker update is selection-only

- **WHEN** the user changes any picker level without submitting a message
- **THEN** the system MUST update only `selectedNextTarget`
- **AND** the system MUST NOT create a hidden binding or start a native session

### Requirement: Turn Attribution MUST Read TurnExecutionSnapshot

Every turn badge, usage record, error, retry, recovery action, and reload projection MUST be attributed to the immutable `TurnExecutionSnapshot`. The snapshot MUST freeze engine id plus readable CLI name, provider profile identity plus `providerProfileNameSnapshot`, model id plus readable model name, and reasoning at `conversation.turnRequested` creation. Current picker or binding state MUST NOT annotate historical Turns.

Only an explicit absent Provider Profile representing local/default semantics MAY display “本地配置”. A legacy Turn whose Provider identity cannot be proven MUST display an unknown-history label and MUST NOT fabricate local/default identity.

#### Scenario: deleted provider still renders explainable badge

- **WHEN** a provider profile referenced by a completed turn's snapshot has been deleted
- **THEN** the turn badge MUST display the snapshot's provider name
- **AND** the badge MUST mark the provider as unavailable without rewriting the snapshot

#### Scenario: two provider turns preserve distinct attribution after reload

- **WHEN** a Shared Session sends one Turn through Claude Provider A and the next through Codex Provider B, then reloads history
- **THEN** each Turn MUST display its frozen CLI, Provider, and Model identity
- **AND** neither Turn MUST be relabeled from the current picker or the other Turn's binding

#### Scenario: legacy provider identity is unknown

- **WHEN** a legacy Turn lacks both an explicit local/default semantic and a durable Provider Profile snapshot
- **THEN** the badge MUST display a human-readable unknown-history label
- **AND** MUST NOT display “本地配置” as a guess

### Requirement: Bindings MUST Be Keyed By Engine Plus Provider Profile

Hidden bindings MUST be indexed by the pair `(engine, providerProfileId)` instead of engine alone. Model MUST NOT be part of the binding key unless a runtime capability explicitly requires a new native session per model.

#### Scenario: same engine with two providers holds two bindings

- **WHEN** a shared session sends turns to `Claude/Official` and `Claude/OpenRouter`
- **THEN** the session MUST hold two distinct hidden bindings
- **AND** each turn MUST execute against the binding matching its snapshot

#### Scenario: model switch within same engine and provider reuses binding

- **WHEN** the user changes only the model while keeping the same engine and provider profile
- **THEN** the system MUST reuse the existing binding
- **AND** the system MUST NOT create a new native session for the model change alone

#### Scenario: switching back reuses the original binding

- **WHEN** a shared session switches `Claude/Official → Codex/OpenAI → Claude/Official`
- **THEN** the third turn MUST resume the original `Claude/Official` binding
- **AND** the session MUST hold exactly two hidden bindings

### Requirement: Legacy Engine-Keyed Bindings MUST Migrate to Default Provider Semantics

When loading a persisted `bindingsByEngine` map, the system MUST migrate each entry to `bindingsByTarget` with `providerProfileId = None` (local/default provider semantics). The system MUST NOT guess or fabricate a managed provider profile for legacy bindings.

#### Scenario: legacy binding restores as default provider binding

- **WHEN** a shared session persisted before this change contains an engine-keyed binding
- **THEN** the migrated binding MUST be keyed as that engine with default-provider semantics
- **AND** the legacy session MUST remain loadable and continuable

#### Scenario: migration does not invent managed provider identity

- **WHEN** a legacy engine-keyed binding is migrated
- **THEN** its `providerProfileId` MUST remain unset rather than being assigned to any managed provider profile

### Requirement: Owner Routing MUST Carry Full Execution Target

Interrupt, approval, pending rebind, and recovery operations MUST be routed by the full execution target (`engine` + `providerProfileId`), not by engine alone.

#### Scenario: dual providers of one engine do not cross-wire operations

- **WHEN** two turns are active on `Claude/Official` and `Claude/OpenRouter` in the same workspace
- **THEN** an interrupt issued for one turn MUST reach only the runtime owning that turn's target
- **AND** the other provider's turn MUST remain unaffected

### Requirement: Shared realtime items MUST freeze execution target identity

When a Native runtime event is owner-routed into a Shared Session, every realtime assistant item for the active Turn MUST carry the immutable `activeTurnTarget` snapshot before entering the Conversation assembler. The renderer MUST NOT subscribe to or infer identity from the mutable Picker.

#### Scenario: realtime assistant displays target badge
- **WHEN** a Shared Turn is running and an assistant realtime item is normalized
- **THEN** the item MUST carry the active Turn's CLI, Provider, Model, and Reasoning snapshot
- **AND** the realtime Badge MUST match the later history Badge

#### Scenario: picker mutation cannot relabel active item
- **WHEN** the next-target Picker changes after a Turn snapshot is frozen
- **THEN** realtime items for the active Turn MUST retain the frozen snapshot
- **AND** MUST NOT read the new Picker value

### Requirement: Explicit local target MUST freeze canonical Provider semantics

The system MUST treat an Execution Target with no Provider Profile ID as explicit local/default execution. At the send/freeze boundary, the mutable selection source `"disk"` MUST be converted to canonical `providerProfileSource = "local"` and persisted with a readable local Provider name. This normalization MUST NOT apply to legacy Turns whose execution target is unknown.

#### Scenario: new local Turn reloads as local configuration
- **WHEN** a new Shared Turn is sent with no Provider Profile ID
- **THEN** its frozen canonical snapshot MUST identify local Provider semantics with `providerProfileSource = "local"`
- **AND** realtime and history badges MUST display “本地配置” rather than “历史配置未知”

#### Scenario: unknown legacy identity remains unknown
- **WHEN** a legacy Turn lacks both explicit local/default semantics and Provider identity
- **THEN** history MUST keep the unknown-history label
- **AND** MUST NOT fabricate local Provider semantics

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

The system MUST keep Provider catalog selection source separate from canonical snapshot source. Provider catalog and mutable `selectedNextTarget` MAY use the selection-domain source `"disk" | "managed"`. `TurnExecutionSnapshot` and canonical Shared facts MUST use the Foundation source `"local" | "managed"`. The system MUST perform this conversion exactly once while freezing the Turn snapshot. Canonical IPC and storage MUST reject `"disk"` and unknown source values rather than silently normalizing them.

#### Scenario: local selection freezes canonical local source

- **WHEN** a Shared Turn freezes a local/default selection whose catalog source is `"disk"`
- **THEN** its `TurnExecutionSnapshot.providerProfileSource` MUST be `"local"`
- **AND** the canonical `conversation.turnRequested` fact MUST pass schema validation

#### Scenario: managed selection preserves managed source

- **WHEN** a Shared Turn freezes a managed Provider selection
- **THEN** its canonical source MUST remain `"managed"`
- **AND** Provider identity, Model, and Reasoning MUST remain unchanged

#### Scenario: invalid canonical source fails closed

- **WHEN** canonical IPC or event validation receives `"disk"` or an unknown `providerProfileSource`
- **THEN** the payload MUST be rejected before runtime side effects
- **AND** the canonical schema MUST NOT be widened to accept the selection-domain value
