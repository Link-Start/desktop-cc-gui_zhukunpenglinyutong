## MODIFIED Requirements

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
