# shared-send-pipeline Specification

## Purpose
TBD - created by archiving change compose-shared-session-execution-target. Update Purpose after archive.
## Requirements
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

### Requirement: Binding Provisioning MUST Be Durable and Crash-Safe

Binding provisioning MUST persist its state (`prepared → creating → ready / recovery-required`) in `shared_binding_state` before invoking the runtime. When the identity ACK is ambiguous, the binding MUST enter `recovery-required`; the system MUST NOT blindly create a second native session for the same target.

#### Scenario: provisioning state survives process kill

- **WHEN** the process is killed after provisioning is prepared but before the identity ACK
- **THEN** on restart the binding MUST be recoverable from its durable provisioning state
- **AND** the system MUST NOT create a duplicate native session for the same target

#### Scenario: ambiguous ack enters recovery-required

- **WHEN** the native session identity ACK is ambiguous (timeout, disconnect, or conflicting evidence)
- **THEN** the binding MUST transition to `recovery-required`
- **AND** the composer MUST offer probe or explicit rebuild instead of automatic retry

#### Scenario: explicit rebuild archives old binding

- **WHEN** the user explicitly rebuilds a `recovery-required` binding
- **THEN** the old binding metadata MUST be archived
- **AND** a new native session MUST be created while the shared session identity stays unchanged

### Requirement: Prompt Acceptance MUST Commit turnAccepted

The V2 send path MUST commit `conversation.turnAccepted` after the runtime's explicit prompt ACK. When the acceptance ACK is ambiguous, the session MUST enter `recovery-required`; the send path MUST NOT record acceptance and MUST NOT re-issue the prompt for the same attempt without probe resolution.

#### Scenario: explicit prompt ack commits turnAccepted

- **WHEN** the runtime explicitly acknowledges the prompt for a turn attempt
- **THEN** the send path MUST commit `conversation.turnAccepted` for that attempt
- **AND** the composer MUST transition from `awaiting-acceptance` to `running`

#### Scenario: ambiguous acceptance ack blocks silent retry

- **WHEN** the prompt acceptance ACK is ambiguous (timeout, disconnect, or conflicting evidence)
- **THEN** the session MUST enter `recovery-required`
- **AND** the system MUST NOT commit `turnAccepted` or send another prompt for the same attempt until probe resolution

### Requirement: Turn Commit MUST Follow Settled Ack With Idempotent Sink

A turn MUST only be committed as `conversation.turnCommitted` after the runtime's settled evidence, via the existing idempotent commit sink. Duplicate terminal evidence MUST NOT produce a second commit. Once prompt acceptance is durable, terminal observation MUST remain attached to the exact Runtime Attempt without an arbitrary full-Turn wall-clock deadline; an observer transport failure MUST NOT be treated as Runtime settlement.

#### Scenario: duplicate settled evidence commits once

- **WHEN** the same terminal `run.settled` evidence is delivered multiple times
- **THEN** exactly one `conversation.turnCommitted` fact MUST exist for that attempt
- **AND** the UI MUST show exactly one assistant final

#### Scenario: turn failure keeps snapshot without rerouting

- **WHEN** a turn fails on the selected target
- **THEN** the failure outcome MUST be committed against the original snapshot
- **AND** the system MUST NOT automatically retry on a different provider

#### Scenario: accepted turn outlives the former observer deadline

- **WHEN** an accepted Shared Turn remains active longer than any UI or IPC observation window
- **THEN** the exact Attempt MUST remain `running` until authoritative terminal evidence, explicit interrupt, or Runtime-ended evidence arrives
- **AND** desktop and daemon Provider event forwarders MUST continue forwarding that exact Turn until terminal or Runtime teardown
- **AND** elapsed wall-clock time alone MUST NOT mark its Binding `recovery-required`

#### Scenario: multiple observers wait on one active attempt

- **WHEN** the original terminal observer and a recovery reattachment both wait on the same exact Attempt
- **THEN** settlement or owner removal MUST wake every observer
- **AND** no observer MAY remain pending because another observer consumed the notification

#### Scenario: terminal observer transport detaches from an active attempt

- **WHEN** the terminal observer fails while durable evidence and the coordinator still identify an accepted active Attempt
- **THEN** the system MUST preserve the Runtime owner and frozen Target
- **AND** the observer failure MUST NOT create a failed, cancelled, or recovery terminal fact

### Requirement: Shared Composer MUST Follow the Nine-State UI Machine

The shared session composer MUST implement the nine-state machine: `idle`, `preparing-context`, `degraded-context`, `awaiting-acceptance`, `cancel-pending`, `running`, `settling`, `recovery-required`, `target-unavailable`. The picker MUST be locked in every non-idle state except `target-unavailable`, where the user MUST be able to repair the Target.

The Shared Composer MUST distinguish text editing, queued follow-up creation, and Turn submission. During `running` or `settling`, the user MUST be able to edit a draft and explicitly enqueue a follow-up while the current Attempt retains exclusive Runtime ownership. During `preparing-context`, `degraded-context`, or `awaiting-acceptance`, draft editing MUST remain available but submission MUST stay blocked. `cancel-pending` and `recovery-required` MUST continue to lock the entire Composer because ordering is ambiguous.

#### Scenario: degraded context requires explicit user confirmation

- **WHEN** context preparation produces a lossy projection with omissions
- **THEN** the composer MUST enter `degraded-context` listing omissions and mode
- **AND** the turn MUST NOT be sent until the user explicitly confirms

#### Scenario: ambiguous ack locks the whole shared session

- **WHEN** an acceptance or cancel ACK is ambiguous
- **THEN** the entire shared session composer MUST be locked in `cancel-pending` or `recovery-required`
- **AND** the session MUST NOT accept a next turn on any target until the ambiguity is resolved

#### Scenario: restart restores in-flight state

- **WHEN** the app restarts while a turn was `running`, `settling`, or `recovery-required`
- **THEN** the restored UI MUST resume the corresponding non-idle state from durable evidence
- **AND** a uniquely identified accepted live owner MUST regain an exact terminal observer before remaining `running`
- **AND** an absent or ambiguous owner MUST remain `recovery-required`
- **AND** the session MUST NOT silently reset to `idle`

#### Scenario: cancel pending reflects capability

- **WHEN** the user cancels during `awaiting-acceptance` and the adapter supports `cancelPendingDelivery`
- **THEN** the composer MUST enter `cancel-pending` until cancel ACK, terminal evidence, or probe resolution
- **AND** when the capability is unsupported the cancel action MUST be disabled with an explanation

#### Scenario: running turn accepts a frozen queued follow-up

- **WHEN** a Shared Turn is `running` or `settling`
- **THEN** the text editor MUST remain editable and MUST preserve the user's draft
- **AND** explicit submit MUST create one queued follow-up with the current immutable Target and predecessor Attempt identity
- **AND** it MUST NOT create a second Runtime Turn before predecessor settlement

#### Scenario: pre-acceptance states still block follow-up submission

- **WHEN** a Shared Turn is `preparing-context`, `degraded-context`, or `awaiting-acceptance`
- **THEN** the text editor MUST remain editable
- **AND** Enter, the send button, quick commands, and programmatic submit MUST NOT create a queued or Runtime Turn

#### Scenario: terminal owner survives native thread rebind

- **WHEN** a terminal carries the exact Runtime Run identity but its `nativeThreadId` differs because the Binding was materialized or rebound
- **THEN** the terminal MUST settle that Run
- **AND** durable commit ACK MUST transition the Shared Composer back to `idle`
- **AND** a second Turn MUST then be submittable

#### Scenario: stale restore cannot relock a completed turn

- **WHEN** a restore request starts before a complete send cycle and returns stale in-flight evidence after that cycle has durably committed
- **THEN** the stale response MUST NOT replace the current `idle` state with `running`
- **AND** the Composer MUST remain able to submit the next Turn

#### Scenario: ambiguous recovery locks the whole composer

- **WHEN** the Shared Send state is `cancel-pending` or `recovery-required`
- **THEN** text editing and Turn submission MUST both remain locked
- **AND** another Target MUST NOT bypass the unresolved linear ordering

#### Scenario: Probe confirms the exact attempt is still active

- **WHEN** recovery Probe confirms that the coordinator still owns the accepted Attempt
- **THEN** the UI MUST restore that Attempt identity and its frozen `TurnExecutionSnapshot`
- **AND** it MUST reattach a deduplicated terminal observer before representing the Turn as normally running
- **AND** a later durable terminal commit MUST clear the active owner and return the Composer to `idle`

#### Scenario: Probe cannot find a live owner

- **WHEN** durable acceptance exists but the exact Runtime owner is absent after restart or Runtime loss
- **THEN** Probe MUST keep the Attempt in `unknown` recovery
- **AND** the UI MUST NOT fabricate `running`, resend the prompt, or infer a Target from the current Picker

#### Scenario: stale reattachment resolves after a successor owns the thread

- **WHEN** an old Attempt's terminal observer resolves after a different Attempt has become the current UI owner
- **THEN** the old `runtimeTurnId` terminal barrier MUST still be installed
- **AND** cleanup MUST compare the exact `attemptId`
- **AND** the successor's processing state, active owner, and frozen Target MUST remain intact

### Requirement: V2 Send MUST Be Feature-Flagged With V0 Rollback

The V2 send path MUST be the default Shared Session send path after Phase 2 rollout. The build-time `VITE_MOSSX_SHARED_V2_SEND` flag or local `mossx.sharedV2Send` override MUST allow an explicit negative value to select V0 rollback. An absent flag MUST NOT silently select V0. Rollback MUST NOT delete already-committed V2 facts.

#### Scenario: absent flag uses V2

- **WHEN** neither build flag nor local override is configured
- **THEN** Shared Session sends MUST use the V2 path
- **AND** the full selected Execution Target MUST reach runtime dispatch

#### Scenario: explicit flag off preserves V0 rollback

- **WHEN** the V2 send flag is explicitly disabled
- **THEN** Shared Session sends MUST use the V0 rollback path
- **AND** no V2 send-path state machine UI MUST be shown

#### Scenario: rollback keeps committed facts readable

- **WHEN** the flag is turned off after V2 turns were committed
- **THEN** previously committed canonical facts MUST remain intact in the event log
- **AND** the V0 read path MUST continue to work

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

### Requirement: Shared Follow-Up MUST Preserve Its Frozen Dispatch Envelope

A Shared queued follow-up MUST preserve `text`, `images`, per-item send options, the resolved Execution Target, and predecessor Attempt identity until dispatch. The queue MAY use existing client-store persistence, but its Runtime dispatch MUST still begin with the Shared V2 durable-first transaction.

#### Scenario: picker changes after enqueue

- **WHEN** a queued Shared follow-up was created and the mutable Picker later changes
- **THEN** the queued item MUST dispatch with its frozen CLI, Provider, Model, and Reasoning selection
- **AND** it MUST NOT read the new Picker value

#### Scenario: restart restores queued payload

- **WHEN** the app restarts after a Shared follow-up was queued but before it was dispatched
- **THEN** the queue MUST restore the complete serializable payload and frozen Target
- **AND** an invalid persisted envelope MUST fail closed instead of using the current Picker

### Requirement: Shared Runtime Outcome MUST Preserve Replaced Status

Shared Codex terminal normalization MUST read supported nested status shapes and preserve `replaced` as a distinct outcome. It MUST NOT infer success from the `turn/completed` method name alone.

#### Scenario: Codex completion carries nested replaced status

- **WHEN** Codex emits `turn/completed` with `params.turn.status=replaced`
- **THEN** the canonical Attempt outcome MUST be `Replaced`
- **AND** it MUST NOT be committed as `Completed`

### Requirement: Shared Manual Compaction MUST Resolve Durable Binding Owner

Manual compaction from a Shared thread MUST resolve engine, provider profile, Binding generation, and native session identity from durable Shared state. It MUST NOT infer the CLI from the logical Shared thread id.

#### Scenario: Shared Codex target requests manual compaction

- **WHEN** a Shared thread's durable selected Target and Binding identify Codex
- **THEN** manual compaction MUST target that exact provider-scoped native thread
- **AND** compaction lifecycle events MUST project to the logical Shared thread

#### Scenario: Shared unsupported target requests manual compaction

- **WHEN** a Shared thread's durable Target identifies an engine without compaction capability
- **THEN** the request MUST be rejected with an actionable capability reason
- **AND** it MUST NOT call a Codex or Claude runtime
