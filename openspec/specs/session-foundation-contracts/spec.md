# session-foundation-contracts Specification

## Purpose

定义多 CLI × 多 Provider 会话基石的契约层：Canonical Fact envelope 与 8 类 Fact 的字段及兼容语义、ExecutionTarget / TurnExecutionSnapshot / SessionOrigin / ConversationFamilyRef 等领域契约、Binding Key 与 two-phase cursor 规则、NativeHistoryReader 只读边界、Turn 与 Provider Aggregate Usage 归属规则，以及 Runtime ACK capability 必须以本机实测为证据的要求。本 capability 是后续 Shared Event Storage、Canonical Ingress、Execution Target、Context Compiler 与 Provider Continuation 等 change 的契约前提。

## Requirements

### Requirement: Canonical Fact Envelope MUST Use Versioned, Fail-Closed Compatibility Semantics

Shared Canonical Entry MUST carry an integer `schemaVersion`, an opaque `entryId`, `logicalSessionId`, monotonic per-session `sequence`, integer-millisecond `occurredAt`, a closed `factType` enum, the `fact` payload, a `payloadChecksum` in `sha256:<lowercase-hex>` form, optional `provenance`, and `fidelity` of `canonical` or `presentation-only`.

#### Scenario: unsupported schema version fails closed

- **WHEN** a reader encounters an entry whose `schemaVersion` it does not support
- **THEN** it MUST reject the entry with a typed error
- **AND** it MUST NOT coerce, guess, or partially interpret the payload

#### Scenario: unknown fields are preserved, unknown enum values fail closed

- **WHEN** an entry contains fields not present in the schema but valid known enum values
- **THEN** the reader MAY ignore the unknown fields
- **AND** any read-modify-write round-trip MUST preserve them verbatim
- **WHEN** an entry contains an unknown value for `factType`, `mode`, `outcome.status`, `fidelity`, or any other closed enum
- **THEN** the reader MUST fail closed with a typed error and MUST NOT map it to a default value

#### Scenario: optional fields omit rather than null

- **WHEN** an optional field has no value
- **THEN** producers MUST omit the field instead of emitting `null`
- **AND** validators MUST reject `null` for fields not explicitly declared nullable

### Requirement: Canonical Fact Set MUST Cover Turn Lifecycle and Usage Attribution

The contract MUST define JSON Schemas for `conversation.turnRequested`, `context.deliveryPrepared`, `context.deliveryAccepted`, `conversation.turnAccepted`, `conversation.turnCommitted`, `conversation.usageRecorded`, `conversation.controlFact`, and a standalone schema for `provider.usageAggregateRecorded`; valid samples MUST pass validation and invalid samples MUST be rejected.

#### Scenario: turn lifecycle facts bind one attempt to one immutable snapshot

- **WHEN** a turn attempt is created
- **THEN** its `TurnExecutionSnapshot` MUST be frozen at `conversation.turnRequested` and MUST NOT be mutated afterwards
- **AND** each `attemptId` MUST have at most one `conversation.turnAccepted` and one `conversation.turnCommitted`
- **AND** retry/regenerate MUST reuse `logicalTurnId`, create a new `attemptId`, and record `retryOfAttemptId`

#### Scenario: terminal commit covers failure outcomes

- **WHEN** a turn ends as `failed`, `cancelled`, or `replaced`
- **THEN** a `conversation.turnCommitted` MUST still be written exactly once with the corresponding `outcome.status`
- **AND** `committed` MUST mean the terminal fact is durably persisted, not that the agent succeeded

#### Scenario: usage attribution separates turn-scoped and provider-window reports

- **WHEN** usage is reported for a single attempt
- **THEN** it MUST be recorded as `conversation.usageRecorded` with `usageRecordId = hash(source + reportSubjectId + revision)` and idempotent replay on `usageRecordId`
- **WHEN** a provider report covers a billing window across attempts
- **THEN** it MUST be recorded as `provider.usageAggregateRecorded` in an independent Provider Usage Ledger keyed by provider, window, report subject, and revision
- **AND** an `aggregate-only` breakdown MUST NOT be allocated to any turn or session by guessing

### Requirement: Domain Contracts MUST Keep Five Object Kinds Unambiguous

ExecutionTarget, TurnExecutionSnapshot, NativeSessionBinding, SharedTargetBinding, SessionOrigin, and ConversationFamilyRef MUST keep Native Session, Shared Session, Subagent, User Fork, and Provider Continuation from sharing one parent/child semantic.

#### Scenario: parent vs lineage vs shared ownership stay separate

- **WHEN** any session relationship is persisted
- **THEN** `parentSessionId` MUST express only runtime-owned Subagent ownership and MUST be the only field that triggers Sidebar nesting
- **AND** `lineageParentSessionId` inside `ConversationFamilyRef` MUST express user-owned Fork/Provider-Continuation lineage without triggering nesting
- **AND** Subagent and Shared Binding MUST NOT enter any Conversation Family
- **AND** Provider Continuation MUST NOT be written through the Subagent relationship writer or `parentThreadId`

#### Scenario: provider deletion keeps history explainable

- **WHEN** a Provider Profile is deleted after turns were executed with it
- **THEN** historical turns MUST remain explainable from `providerProfileId` plus `providerProfileNameSnapshot` stored in the snapshot
- **AND** resume/send against the deleted profile MUST fail closed rather than fall back to local/default

#### Scenario: binding key excludes model by default

- **WHEN** a SharedTargetBinding key is derived
- **THEN** it MUST be composed of `engine + providerProfileId` only
- **AND** changing only `model` MUST NOT create a new binding, unless an explicit runtime capability exception is recorded

### Requirement: Cursor Contract MUST Separate Accepted and Committed Progress

`BindingContextCursor` MUST keep `acceptedThroughSequence`, `committedThroughSequence`, and `pendingDelivery` as distinct state, and `BindingProvisioningState` MUST be persisted independently of `pendingDelivery`.

#### Scenario: acknowledged input is never re-injected after failure

- **WHEN** the target runtime has explicitly acknowledged a context/prompt delivery and the subsequent run fails
- **THEN** `acceptedThroughSequence` MUST remain advanced
- **AND** retry MUST NOT re-inject the same context package
- **AND** `committedThroughSequence` MUST only advance after the terminal canonical fact is durably committed

#### Scenario: ambiguous ack requires probe before any new side effect

- **WHEN** an acknowledgement is ambiguous after a crash or disconnect
- **THEN** the system MUST keep `pendingDelivery` and probe native history or run identity before deciding to retry
- **AND** while unresolved, the Shared Session MUST NOT accept another turn, including turns targeting a different provider
- **AND** a binding whose provisioning ack is uncertain MUST enter `recovery-required` instead of blindly creating a second binding for the same key

### Requirement: NativeHistoryReader MUST Be Read-Only and Fail Closed on Unstable Sources

Provider Continuation MUST read source history only through a `NativeHistoryReader` anti-corruption layer, and MUST persist an immutable `NativeHistoryMaterialization` before any target side effect.

#### Scenario: unstable cursor source is rejected

- **WHEN** a reader probe reports `stableCursor = false` or no `currentThroughCursor`
- **THEN** continuation MUST fail closed with a typed unsupported error
- **AND** it MUST NOT materialize from a growing or guessed history range

#### Scenario: materialization is replayable without re-reading the source

- **WHEN** a continuation operation has committed its `NativeHistoryMaterialization` with fingerprint, cursor, and checksums
- **THEN** retries MUST replay from the stored artifact references
- **AND** later growth, deletion, or permission changes of the source history MUST NOT affect the prepared operation

### Requirement: Legacy Data MUST NOT Be Rewritten or Enriched by Guessing

Legacy Shared snapshots MUST be projected with `fidelity = "presentation-only"`, and legacy or fixture data MUST NOT be enriched with fabricated protocol facts.

#### Scenario: legacy snapshot dual-read preserves provenance honesty

- **WHEN** a legacy Shared snapshot lacks authoritative Provider or Model provenance
- **THEN** only engine provenance MUST be recorded
- **AND** Tool Call IDs, reasoning signatures, and provider response IDs MUST NOT be fabricated
- **AND** known truncations MUST be recorded as explicit omissions

### Requirement: Runtime Capability Contracts MUST Be Evidence-Based

Adapter contracts for Codex, Claude, and Kimi MUST be grounded in measured spikes against the installed binaries, recording binary path, version, hash, and protocol identity; CLI documentation or assumptions MUST NOT substitute for measured evidence.

#### Scenario: spike matrices gate adapter scope

- **WHEN** Wave 2 or later changes define adapter behavior for `thread/inject_items`, `--replay-user-messages`, or Kimi ACP
- **THEN** the referenced capability MUST appear as measured PASS in the corresponding spike matrix for a recorded binary identity
- **AND** any capability measured FAIL or PARTIAL MUST be handled through explicit degradation wording rather than assumed exactly-once semantics

#### Scenario: capability cache keys include binary identity

- **WHEN** runtime capabilities are cached
- **THEN** the cache key MUST include engine, binary identity, binary version, and protocol or schema fingerprint
- **AND** historical turns MUST be interpreted with the capability snapshot of their own time, not reinterpreted under newer CLI capabilities

### Requirement: Golden Fixtures MUST Be Real, Sanitized, and Repeatably Loadable

Claude and Codex native history plus live event fixtures MUST be captured from real sessions, sanitized of credentials and personal paths, trimmed without fabricating field semantics, and covered by a loader test that repeatably parses them.

#### Scenario: fixtures load repeatably with manifest coverage

- **WHEN** the fixture loader test runs
- **THEN** every fixture line MUST parse as valid JSON with required fields present
- **AND** the manifest MUST record source CLI, binary version, capture date, covered entry types, and fidelity notes
- **AND** fixture trimming MUST only delete whole entries or mark truncated text, never rewrite field semantics
