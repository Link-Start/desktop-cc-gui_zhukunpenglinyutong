# assemble-shared-canonical-facts Specification

## Purpose

定义 Shared Session V2 的 Canonical Fact 装配层：把 Runtime 事件流转换为符合 Wave 0 Schema 的 canonical fact，经字段级校验后通过 `SharedEventWriter` 唯一入口落盘。本 capability 是 UI Projection（A3）、Execution Target（B）与 Context Compiler（C）的 authoritative 事实源前提。

## ADDED Requirements

### Requirement: Canonical Fact Payload MUST Be Validated Before Append

`SharedEventWriter::append_canonical_fact` MUST validate the fact against the Wave 0 Canonical Fact Schema before computing sequence or checksum. Invalid payloads MUST be rejected with a typed error and MUST NOT be inserted into `shared_event_log`.

#### Scenario: valid fact is accepted

- **WHEN** a `conversation.turnRequested` fact with all required fields is appended
- **THEN** the writer returns `Inserted` with a monotonically allocated sequence and a `sha256:` checksum

#### Scenario: missing required field is rejected

- **WHEN** a `conversation.turnCommitted` fact is appended without `logicalTurnId`
- **THEN** the writer returns a typed validation error
- **AND** no row is written to `shared_event_log`

#### Scenario: unknown enum value is rejected

- **WHEN** a fact contains `outcome.status = "unknown-status"`
- **THEN** the writer returns a typed validation error

### Requirement: Each `turnRequested` Attempt MUST Be Committed Exactly Once

The Critical Commit Sink MUST generate one `conversation.turnCommitted` fact per `attemptId` when `run.settled` occurs. Repeated settlement of the same attempt MUST be deduplicated by the `(session_id, attempt_id, fact_type)` partial unique index.

#### Scenario: normal settlement commits once

- **WHEN** a Run settles with a successful final snapshot for attempt `a1`
- **THEN** exactly one `conversation.turnCommitted` row with `attempt_id = "a1"` exists

#### Scenario: duplicate settlement is idempotent

- **WHEN** the same settled Run emits the same terminal evidence 100 times
- **THEN** exactly one `conversation.turnCommitted` row with that `attempt_id` exists
- **AND** subsequent appends return `Duplicate` carrying the existing sequence

#### Scenario: settlement blocked if storage transaction fails

- **WHEN** the SQLite transaction for `turnCommitted` returns an error
- **THEN** the `run.settled` boundary MUST NOT advance to `idle`
- **AND** the Run remains recoverable for retry commit

### Requirement: `conversation.turnCommitted` MUST Be Assembled From Authoritative Final Snapshot

The Run/Turn Assembler MUST consume the Runtime Lifecycle Owner's authoritative final snapshot, not streaming deltas. The committed fact MUST contain assistant blocks, atomic tool exchanges, artifact refs, omissions, and outcome.

#### Scenario: complete assistant turn

- **WHEN** the final snapshot contains assistant text only
- **THEN** `turnCommitted.assistant` contains the text block
- **AND** `atomicToolExchanges` is empty
- **AND** `outcome.status` is `completed`

#### Scenario: turn with tool call and result

- **WHEN** the final snapshot contains one Tool Call and one matching Tool Result
- **THEN** `atomicToolExchanges` contains one exchange with `request` and `response`
- **AND** `response.status` is `completed`

#### Scenario: failed outcome

- **WHEN** the final snapshot indicates the turn failed
- **THEN** `outcome.status` is `failed`
- **AND** `outcome.errorCode` is present

### Requirement: Atomic Tool Exchange MUST Be Explicitly Settled

The Assembler MUST NOT emit a `completed` Tool Exchange unless both Tool Call and matching Tool Result are present. Unpaired Tool Calls MUST be settled as `incomplete` or `error`; unpaired Tool Results MUST be dropped or recorded as a `controlFact`.

#### Scenario: unpaired tool call

- **WHEN** the final snapshot has a Tool Call without a matching Result
- **THEN** the exchange is emitted with `response.status = "incomplete"`

#### Scenario: unpaired tool result

- **WHEN** the final snapshot has a Tool Result without a preceding Tool Call
- **THEN** it MUST NOT appear as a `completed` exchange in `turnCommitted`

### Requirement: Usage Facts MUST Be Normalized and Correctly Attributed

`conversation.usageRecorded` MUST be attempt-scoped and deduplicated by `usageRecordId`. `provider.usageAggregateRecorded` MUST be written to the independent Provider Usage Ledger and MUST NOT carry a `session_id`.

#### Scenario: per-attempt usage recorded

- **WHEN** a Run reports usage for attempt `a1`
- **THEN** a `conversation.usageRecorded` fact is appended with `attempt_id = "a1"`
- **AND** repeated reports with the same `usageRecordId` produce no second row

#### Scenario: provider aggregate usage goes to ledger

- **WHEN** a Provider reports a billing-window aggregate
- **THEN** a `provider.usageAggregateRecorded` row is written to `provider_usage_aggregate_log`
- **AND** the row has no `session_id` column
- **AND** repeated reports with the same `(provider, window, subject, revision)` are idempotent

#### Scenario: runtime-final and provider-report for same attempt

- **WHEN** both `runtime-final` and `provider-report` usage exist for the same attempt
- **THEN** Projection MUST prefer the `provider-report` version
- **AND** the two versions MUST NOT be summed

### Requirement: V0 Final Evidence MUST Be Mappable To a Read-Only Shadow Canonical Log

Legacy Shared Session V0 final evidence MAY be imported as canonical facts with `fidelity = "presentation-only"`. These facts MUST be read-only and MUST NOT participate in new Turn assembly or be treated as authoritative.

#### Scenario: v0 evidence mapped

- **WHEN** a V0 final evidence file is imported
- **THEN** each mapped row has `fidelity = "presentation-only"`
- **AND** the row is stored in `shared_event_log`
- **AND** no product state is modified

## MODIFIED Requirements

### Requirement: Event Storage MUST Accept Canonical Facts Through a Validated Entry Point

The store MUST use SQLite in WAL mode with `foreign_keys=ON`, `synchronous=FULL`, and a bounded `busy_timeout`; all canonical fact writes MUST go through `SharedEventWriter::append_canonical_fact`, which SHALL validate the fact before delegating to the single writer actor.

> 修改自 `shared-event-storage` 同一条 Requirement：单写者语义不变，增加“所有 canonical fact 写入必须经过 `append_canonical_fact` 并先通过 payload 校验”。

#### Scenario: direct arbitrary envelope append is discouraged

- **WHEN** a caller tries to append a raw JSON envelope that does not represent a validated canonical fact
- **THEN** the public API SHOULD reject it or mark it `presentation-only`
- **AND** no `canonical` fidelity row is created without validation

## REMOVED Requirements

无。
