# engine-message-delivery-semantics Specification

## Purpose
TBD - created by archiving change define-engine-message-delivery-semantics. Update Purpose after archive.
## Requirements
### Requirement: Message Delivery MUST Use Explicit Intent

Every engine message delivery request MUST declare `prompt`、`steer`、`followUp` or `nextTurn` and MUST return a typed accepted、rejected or degraded result.

#### Scenario: caller omits intent

- **WHEN** a new delivery caller provides message content without intent
- **THEN** typecheck or command validation MUST reject the request

### Requirement: Steering MUST Require Active Run And Mid-Turn Capability

`steer` MUST only target an active run whose adapter reports `input.mid-turn=supported`. `input.mid-turn=compat-input` MUST NOT be represented as same-run steer; callers MAY explicitly degrade it to follow-up or execute a separately evidenced interrupt/settle/successor cutover.

#### Scenario: Kimi receives steering request

- **WHEN** Kimi has no writable mid-turn input channel
- **THEN** steering MUST be rejected with capability reason
- **AND** the system MUST NOT report the message as sent

#### Scenario: caller explicitly permits fallback

- **WHEN** steering is not `supported` and caller explicitly requests follow-up fallback
- **THEN** the result MUST identify the degradation with `route=queue`
- **AND** the message MUST enter the follow-up queue exactly once

#### Scenario: compat input is not same-run steer

- **WHEN** an adapter reports `input.mid-turn=compat-input`
- **THEN** the delivery resolver MUST NOT return `route=steer`
- **AND** Fusion MUST require independent cutover settlement and successor-start evidence

### Requirement: Follow-Up MUST Drain Only After Run Settlement

Follow-up items MUST remain queued until the predecessor emits `run.settled`; response acceptance, delta, engine-specific child Turn completion, or compaction start MUST NOT drain the queue. Shared follow-up dispatch MUST additionally wait for canonical terminal commit and any active compaction barrier.

#### Scenario: duplicate settlement arrives

- **WHEN** the same run settlement is observed more than once
- **THEN** each follow-up item MUST be delivered at most once

#### Scenario: compaction follows predecessor completion

- **WHEN** predecessor terminal evidence is followed by an in-flight compaction control Turn
- **THEN** Shared follow-up MUST remain queued until compaction completes or fails
- **AND** it MUST then dispatch at most once

### Requirement: Delivery Decisions MUST Be Diagnosable

Every delivery decision MUST record intent、target session/run、capability evidence、result and fallback reason without storing secrets.

#### Scenario: message is rejected

- **WHEN** runtime/session state makes delivery impossible
- **THEN** UI MUST receive an actionable reason
- **AND** diagnostics MUST preserve the decision evidence
