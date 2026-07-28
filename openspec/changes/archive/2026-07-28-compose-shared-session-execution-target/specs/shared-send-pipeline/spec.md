# shared-send-pipeline Specification

## Purpose

定义 Shared Session 的 V2 Send 写路径与 UI 状态机：`providerProfileId` 贯通、Tx1 durable-first `turnRequested`、`TurnExecutionSnapshot` 固化、durable Binding Provisioning 与 duplicate-create recovery、以及 §14.5 九状态 UI 状态机。本 capability 结束 dark launch：真实 Shared 流量经 feature flag 切到 V2 Canonical Log，可回滚。

## ADDED Requirements

### Requirement: Send MUST Commit turnRequested Before Touching Runtime

The V2 send path MUST commit `conversation.turnRequested` (with the immutable `TurnExecutionSnapshot`) in the first transaction before any runtime side effect. The send path MUST thread `providerProfileId` from the selected target through snapshot, binding lookup, and runtime dispatch.

#### Scenario: user intent is durable before runtime call

- **WHEN** a user submits a message in a shared session with V2 send enabled
- **THEN** `conversation.turnRequested` MUST be committed to the canonical log before the runtime is invoked
- **AND** the committed fact MUST carry the full target snapshot including provider profile

#### Scenario: provider profile id reaches runtime dispatch

- **WHEN** a turn targets a managed provider profile
- **THEN** the runtime dispatch MUST receive that `providerProfileId`
- **AND** the turn MUST NOT silently fall back to the disk/default provider

#### Scenario: unavailable target blocks send without rerouting

- **WHEN** the selected provider is unavailable or the model is outside the provider catalog
- **THEN** the send MUST be blocked with a target-unavailable state
- **AND** the system MUST NOT reroute to another provider or default model

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

A turn MUST only be committed as `conversation.turnCommitted` after the runtime's settled evidence, via the existing idempotent commit sink. Duplicate terminal evidence MUST NOT produce a second commit.

#### Scenario: duplicate settled evidence commits once

- **WHEN** the same terminal `run.settled` evidence is delivered multiple times
- **THEN** exactly one `conversation.turnCommitted` fact MUST exist for that attempt
- **AND** the UI MUST show exactly one assistant final

#### Scenario: turn failure keeps snapshot without rerouting

- **WHEN** a turn fails on the selected target
- **THEN** the failure outcome MUST be committed against the original snapshot
- **AND** the system MUST NOT automatically retry on a different provider

### Requirement: Shared Composer MUST Follow the Nine-State UI Machine

The shared session composer MUST implement the nine-state machine: `idle`, `preparing-context`, `degraded-context`, `awaiting-acceptance`, `cancel-pending`, `running`, `settling`, `recovery-required`, `target-unavailable`. The picker MUST be locked in every non-idle state.

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

### Requirement: V2 Send MUST Be Feature-Flagged With V0 Rollback

The V2 send path MUST be gated behind a feature flag (build-time `VITE_MOSSX_SHARED_V2_SEND` or local override). With the flag off, shared sessions MUST behave exactly as V0. Rollback MUST NOT delete already-committed V2 facts.

#### Scenario: flag off preserves V0 behavior

- **WHEN** the V2 send flag is disabled
- **THEN** shared session sends MUST use the V0 path
- **AND** no V2 send-path state machine UI MUST be shown

#### Scenario: rollback keeps committed facts readable

- **WHEN** the flag is turned off after V2 turns were committed
- **THEN** previously committed canonical facts MUST remain intact in the event log
- **AND** the V0 read path MUST continue to work
