## MODIFIED Requirements

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
- **AND** a queued follow-up MAY then be dispatched against its frozen Target

#### Scenario: stale restore cannot relock a completed turn

- **WHEN** a restore request starts before a complete send cycle and returns stale in-flight evidence after that cycle has durably committed
- **THEN** the stale response MUST NOT replace the current `idle` state with `running`
- **AND** the Composer MUST remain able to submit the next Turn

#### Scenario: ambiguous recovery locks the whole composer

- **WHEN** the Shared Send state is `cancel-pending` or `recovery-required`
- **THEN** text editing and Turn submission MUST both remain locked
- **AND** another Target MUST NOT bypass the unresolved linear ordering

## ADDED Requirements

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
