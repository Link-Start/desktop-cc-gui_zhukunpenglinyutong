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

Every turn badge, usage record, error, retry, and recovery action MUST be attributed to the immutable `TurnExecutionSnapshot`, which MUST include `providerProfileNameSnapshot`. When the provider profile is later deleted, history MUST remain explainable via the name snapshot.

#### Scenario: deleted provider still renders explainable badge

- **WHEN** a provider profile referenced by a completed turn's snapshot has been deleted
- **THEN** the turn badge MUST display the snapshot's provider name
- **AND** the badge MUST mark the provider as unavailable without rewriting the snapshot

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
