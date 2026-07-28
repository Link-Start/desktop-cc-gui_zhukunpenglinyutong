## MODIFIED Requirements

### Requirement: Send MUST Commit turnRequested Before Touching Runtime

The V2 send path MUST commit `conversation.turnRequested` (with the immutable `TurnExecutionSnapshot`) in the first transaction before any runtime side effect. The send path MUST thread `providerProfileId` from the selected target through snapshot, binding lookup, context compilation, delivery, and runtime dispatch. After Binding provisioning, it MUST compile a Context Package and commit `context.deliveryPrepared` plus durable pending delivery before importing context or sending a prompt.

#### Scenario: user intent is durable before runtime call

- **WHEN** a user submits a message in a shared session with V2 send enabled
- **THEN** `conversation.turnRequested` MUST be committed to the canonical log before the runtime is invoked
- **AND** the committed fact MUST carry the full target snapshot including provider profile

#### Scenario: provider profile id reaches runtime dispatch

- **WHEN** a turn targets a managed provider profile
- **THEN** context compilation and runtime dispatch MUST receive that `providerProfileId`
- **AND** the turn MUST NOT silently fall back to the disk/default provider

#### Scenario: unavailable target blocks send without rerouting

- **WHEN** the selected provider is unavailable or the model is outside the provider catalog
- **THEN** the send MUST be blocked with a target-unavailable state
- **AND** the system MUST NOT reroute to another provider or default model

#### Scenario: context intent precedes context side effect

- **WHEN** a Context Package is ready for import or prompt-prefix delivery
- **THEN** `context.deliveryPrepared` and matching pending delivery MUST commit before the Adapter call
- **AND** compile failure MUST produce no delivery side effect

## ADDED Requirements

### Requirement: Shared Send MUST Respect Context Acceptance Boundary

Shared V2 send MUST wait for runtime-specific context acceptance before prompt acceptance and MUST expose degraded projection details before any lossy delivery.

#### Scenario: lossy package waits for confirmation

- **WHEN** the Context Package Manifest contains omissions or lossy transformations
- **THEN** the composer MUST show mode, disposition, and compression details
- **AND** no context or prompt side effect MUST occur until the user confirms

#### Scenario: accepted context survives failed run

- **WHEN** context is accepted and the subsequent prompt/run fails
- **THEN** the accepted cursor MUST remain advanced
- **AND** a later attempt MUST compile only entries after that accepted boundary
