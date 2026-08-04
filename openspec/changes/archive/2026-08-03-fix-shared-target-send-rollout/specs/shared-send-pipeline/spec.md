## MODIFIED Requirements

### Requirement: V2 Runtime Dispatch MUST Be Attempt-Owned

The V2 dispatch boundary MUST identify an already-durable attempt and load its
`conversation.turnRequested.target` before any Runtime side effect. It MUST NOT call the V0 send
command or accept a second flat Engine/Provider/Model/Reasoning authority. The effective Binding
key MUST be Engine plus Provider Profile, and provider-specific failure MUST fail that Turn
without default fallback.

A Target-bearing `prepare_context` call MAY exist only as a read-only preview. The sole
Target-bearing mutation MUST be `begin_turn`; after it durably freezes the Target,
`prepare_delivery`, Runtime dispatch, Context/Prompt acceptance, commit, recovery, interrupt, and
rebuild routing MUST derive owner identity from the durable Attempt or Binding row. Frontend MUST
NOT submit independent acceptance facts.

#### Scenario: actual runtime follows durable target

- **WHEN** a Shared attempt durably selects Codex Provider A and runtime Model A
- **THEN** the observed Runtime process/session key and `turn/start.model` MUST correspond to
  Provider A and Model A
- **AND** mocked IPC parameter equality alone MUST NOT satisfy this acceptance criterion

#### Scenario: switching provider creates and reuses correct binding

- **WHEN** the user sends with Provider A, switches to Provider B, then switches back to Provider A
- **THEN** the first two Turns MUST use distinct Provider-keyed Bindings
- **AND** the third Turn MUST reuse Provider A's Binding
- **AND** no Turn may silently route through the Engine default Provider

#### Scenario: context preview has no mutation side effect

- **WHEN** the Composer previews Context fidelity for a complete Target
- **THEN** the preview MAY read canonical facts and existing Binding/Cursor evidence
- **AND** it MUST NOT create an Attempt or Binding, append a delivery fact, advance a Cursor, or
  invoke Runtime

#### Scenario: post-begin commands cannot restate target

- **WHEN** `conversation.turnRequested` has durably frozen Target A
- **THEN** delivery, dispatch, acceptance, commit, recovery, and interrupt command shapes MUST
  identify the Attempt without accepting a second Target
- **AND** stale flat Target B MUST have no way to override Target A

#### Scenario: typed dispatch ack conflicts with snapshot

- **WHEN** Runtime dispatch returns an Engine, Provider, runtime Model, Reasoning, or Binding that
  conflicts with the durable Attempt owner
- **THEN** the Attempt MUST fail closed or enter explicit recovery before `running`
- **AND** partial ACK equality MUST NOT be accepted as proof

#### Scenario: rebuild derives target from binding row

- **WHEN** a user explicitly rebuilds a recovery-required Binding
- **THEN** the command MUST accept only the durable `bindingKey` as routing identity
- **AND** Engine and Provider MUST be derived from and validated against the stored Binding row
- **AND** caller-supplied Target fields MUST NOT rewrite the Binding

### Requirement: Picker MUST NOT Provision Runtime Binding

Changing CLI, Provider, Model, or Reasoning in the Shared picker MUST update only
`selectedNextTarget`. Runtime Binding lookup or provisioning MUST begin only after a Turn snapshot
has been durably requested.

#### Scenario: picker change has no runtime side effect

- **WHEN** the user changes any Shared Target selector without sending
- **THEN** no native Thread, Provider process, Binding, or canonical Turn fact MUST be created

### Requirement: Runtime Lifecycle MUST Own Canonical Terminal Commit

The Runtime lifecycle owner MUST assemble authoritative terminal content before ordinary UI
fan-out, throttling, or delta drop. A terminal commit MUST preserve ordered assistant text,
Reasoning, Tool exchanges, Artifacts, omissions/private references, immutable Target, and
structured outcome. Frontend terminal observation MUST NOT be the canonical persistence source.

Events that arrive before exact Runtime identity binding MUST be retained and released through an
atomic Rust replay barrier. While the barrier is open, both early and newly arriving visible
events MUST remain ordered. Authoritative observation MUST be published before the corresponding
UI event. An exact Claude Context echo MAY update ACK state inside the barrier to avoid deadlock,
but MUST NOT let later visible events overtake earlier ones.

#### Scenario: terminal reload preserves rich content

- **WHEN** a Runtime terminal contains assistant text, Reasoning, Tool call/result, Artifact, and
  structured failure metadata
- **THEN** one idempotent canonical commit MUST persist those blocks with the attempt snapshot
- **AND** Shared history reload MUST reproduce their order and per-Turn CLI/Provider/Model label

#### Scenario: dropped streaming delta does not corrupt history

- **WHEN** an ordinary UI streaming delta is throttled or dropped but authoritative terminal
  evidence arrives
- **THEN** canonical history MUST reconstruct from terminal evidence
- **AND** `liveAssistantTextChannel` MUST remain externalized from the root reducer

#### Scenario: event arrives before runtime identity bind

- **WHEN** assistant, Reasoning, Tool, or terminal ingress arrives before the dispatch response
  exposes exact Runtime identity
- **THEN** Rust MUST retain the event, bind it to the durable Attempt, and replay it in arrival
  order
- **AND** an event arriving during replay MUST remain behind the existing barrier queue
- **AND** no frontend observer may become a second replay or persistence authority

#### Scenario: early context echo does not deadlock replay

- **WHEN** a Claude replay user-message containing the exact package/checksum marker arrives
  before visible replay drains
- **THEN** Context ACK waiting MUST be able to observe that marker
- **AND** assistant, Reasoning, Tool, and terminal events MUST still preserve replay order

#### Scenario: duplicate terminal is exactly once

- **WHEN** equivalent terminal evidence arrives before and after the replay barrier clears
- **THEN** the coordinator MUST retain one settlement and canonical commit
- **AND** the UI MUST render one assistant final

#### Scenario: equivalent Claude full observations are canonicalized once

- **WHEN** Claude Shared emits an equivalent cumulative/full assistant or reasoning observation
  more than once, including a duplicated terminal fallback
- **THEN** the Shared coordinator MUST retain one canonical copy of that semantic content
- **AND** it MUST preserve ordinary incremental fragments that add new content
- **AND** Codex Shared accumulation and Native Claude rendering MUST remain unchanged

#### Scenario: non-retry Codex error is terminal failure

- **WHEN** Codex emits an `error` ingress with `willRetry=false` before a later
  `turn/completed` transport notification
- **THEN** the Attempt MUST commit exactly once with outcome `failed`
- **AND** nested error message and code MUST be preserved as canonical failure metadata
- **AND** the later transport completion MUST NOT rewrite the outcome to `completed`

#### Scenario: interrupt error follows attempt cancel intent

- **WHEN** an attempt-owned interrupt intent is registered before Runtime emits a synchronous
  turn error
- **THEN** that terminal MUST settle as `cancelled`
- **AND** if the Runtime interrupt side effect itself fails, the intent MUST be cleared so a later
  real error remains `failed`

### Requirement: Shared V2 Projection MUST Be Canonical By Default

New V2 Shared Turns MUST render from canonical projection without requiring a local override.
Legacy Shared history MUST remain visible through explicit dual-read compatibility. Native
Session files MUST NOT be imported or concatenated into Shared history.

#### Scenario: reload shows immutable provenance without flag

- **WHEN** a V2 Shared Session is reloaded with no projection localStorage flag
- **THEN** every new Turn MUST retain its frozen CLI, Provider, Model, Reasoning, and outcome
- **AND** changing the current picker MUST NOT alter prior Turn labels

#### Scenario: legacy history remains visible

- **WHEN** a Shared Session contains legacy-only Turns plus new canonical Turns
- **THEN** the projection MUST preserve both sources without duplicate Turns
- **AND** unverifiable legacy Provider identity MUST remain “历史配置未知”

#### Scenario: reasoning-only or tool-only turn keeps provenance

- **WHEN** a completed Turn has no assistant text block but has Reasoning or Tool content
- **THEN** projection MUST preserve a non-visible provenance anchor carrying the immutable Target
- **AND** the Turn MUST still display its CLI, Provider, and Model label without fabricated text

#### Scenario: shared runtime prompt echo is presentation-only control

- **WHEN** Native Runtime replays the exact versioned Shared Context prompt envelope with matching
  package/checksum markers
- **THEN** presentation MUST hide only that duplicate user transport item
- **AND** the canonical user input and subsequent assistant, Reasoning, Tool, and Error content
  MUST remain visible
- **AND** ordinary user text that merely contains `MOSSX` MUST NOT be filtered

### Requirement: Shared Composer MUST Follow the Nine-State UI Machine

The shared session composer MUST implement the nine-state machine: `idle`,
`preparing-context`, `degraded-context`, `awaiting-acceptance`, `cancel-pending`, `running`,
`settling`, `recovery-required`, `target-unavailable`. The picker MUST be locked in every
non-idle state except `target-unavailable`, where the user MUST be able to repair the Target.

The Shared Composer MUST distinguish text editing from Turn submission. During normal non-idle
progress (`preparing-context`, `degraded-context`, `awaiting-acceptance`, `running`, or
`settling`), the user MUST be able to edit and retain a draft while new Turn submission remains
blocked. Draft editing MUST NOT be interpreted as Queue or Steer. `cancel-pending` and
`recovery-required` MUST continue to lock the entire Composer because ordering is ambiguous.

The programmatic send boundary MUST acquire one per-Thread admission after asynchronous preflight
and before optimistic message, activity, or processing mutations. The returned mutation revision
MUST be consumed exactly once by the V2 orchestrator. A read-only state check alone MUST NOT be
treated as a concurrency lock.

#### Scenario: degraded context sends automatically with durable diagnostics

- **WHEN** context preparation produces a valid lossy projection with omissions
- **THEN** Shared Send MUST continue automatically with portable context and the current user
  request
- **AND** omissions, dispositions, compression, and projection mode MUST remain durable
  diagnostic facts
- **AND** the composer MUST NOT block on a continue/cancel confirmation
- **AND** compile failure, invalid ownership, ambiguous ACK, or Provider rejection MUST remain
  fail-closed

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

#### Scenario: running turn blocks submit without disabling draft editing

- **WHEN** a Shared Turn is `running` or `settling`
- **THEN** the text editor MUST remain editable and MUST preserve the user's draft
- **AND** Enter, the send button, quick commands, and programmatic submit MUST NOT create a
  second Turn
- **AND** the draft MUST NOT enter Queue or Steer without an explicit future contract

#### Scenario: racing callers create only one optimistic turn

- **WHEN** two Shared V2 callers both pass an earlier idle preflight before either acquires the
  per-Thread admission
- **THEN** exactly one caller MUST consume the admission and reach optimistic UI or Runtime
- **AND** the losing caller MUST create no user bubble, processing mutation, or Runtime RPC

#### Scenario: terminal owner survives native thread rebind

- **WHEN** a terminal carries the exact Runtime Run identity but its `nativeThreadId` differs
  because the Binding was materialized or rebound
- **THEN** the terminal MUST settle that Run
- **AND** durable commit ACK MUST transition the Shared Composer back to `idle`
- **AND** a second Turn MUST then be submittable

#### Scenario: exact attempt owns terminal despite projected runtime identity drift

- **WHEN** a terminal carries the exact durable `attemptId` but its projected `runtimeTurnId` or
  `nativeThreadId` differs from stale frontend owner projection
- **THEN** exact Attempt ownership MUST settle the Turn
- **AND** secondary Runtime identity MUST NOT veto that durable identity match

#### Scenario: stop after canonical commit is idempotent

- **WHEN** the user presses Stop after the Attempt has already canonical committed but before the
  frontend clears its running projection
- **THEN** interrupt MUST return a typed `terminal-committed` ACK without requiring an active
  Runtime route
- **AND** the frontend MUST clear the active Attempt and return the Composer to `idle`
- **AND** it MUST NOT append a fabricated cancelled/stopped outcome

#### Scenario: committed Shared response cannot revive the native turn

- **WHEN** a Shared V2 send waits for Runtime terminal and canonical commit before its command
  response returns
- **THEN** the Shared caller MUST settle processing and return without executing the Native
  Session turn-start response handler
- **AND** it MUST NOT assign `activeTurnId` from the already completed Runtime response

#### Scenario: Shared dispatch terminal convergence is engine-neutral

- **WHEN** any Shared Runtime dispatch returns an accepted start ACK without a typed
  `run.settled`
- **THEN** the frontend MUST await the backend exact Attempt terminal contract
- **AND** backend MUST treat durable `conversation.turnCommitted` as the final completion proof
- **AND** a typed terminal already included in the response MAY be consumed as a fast path
- **AND** absence of an inline terminal MUST NOT be classified as ambiguous delivery
- **AND** Claude, Codex, and future Shared CLI adapters MUST use the same terminal convergence
  contract without Engine-specific branching

#### Scenario: missing frontend terminal event cannot strand a committed send

- **WHEN** Runtime terminal has been canonical committed for the exact Attempt
- **AND** the corresponding projected `app-server-event` is dropped, emitted before listener
  installation, or otherwise not observed by the frontend send subscriber
- **THEN** `shared_session_v2_await_turn_terminal` MUST return the durable committed outcome
- **AND** Shared Composer MUST transition through `runSettled` and `canonicalCommitted` to `idle`
- **AND** realtime events MAY still render content and play notifications but MUST NOT own control
  completion
- **AND** Native Session lifecycle MUST remain unchanged

#### Scenario: Shared logical terminal is not delayed by CLI cleanup

- **WHEN** a Shared-owned Claude Runtime emits a typed final `result`
- **AND** its process, hook, MCP child, stdout/stderr pipe, or usage probe is still cleaning up
- **THEN** the exact Shared Attempt MUST immediately normalize that result into terminal evidence
- **AND** backend durable settlement MUST NOT wait for cleanup `TurnCompleted` or process exit
- **AND** a later cleanup `TurnCompleted` MUST be absorbed exactly once without duplicate commit
  or duplicate assistant content
- **AND** success/error subtype, error code, stop reason, and final text MUST preserve their typed
  result semantics
- **AND** non-Shared Native Claude Session lifecycle MUST remain unchanged

#### Scenario: projected Shared start cannot reactivate Native lifecycle

- **WHEN** a projected `turn/started` event carries a valid Shared V2 owner
- **THEN** it MUST NOT invoke the generic Native Session turn-start lifecycle
- **AND** Shared assistant, reasoning, tool, error, and terminal projections MUST remain visible
- **AND** a non-Shared Native Session event MUST keep the existing lifecycle unchanged

#### Scenario: stop clears an idle Shared UI residue without native interruption

- **WHEN** Shared Send state is already `idle`, its active Attempt has been released, and only a
  stale frontend processing or active-turn projection remains
- **THEN** Stop MUST clear that matching Shared UI residue idempotently
- **AND** it MUST NOT call a Runtime interrupt or append a fabricated terminal outcome
- **AND** the same condition on a Native Session MUST continue through the existing Native
  interrupt contract unchanged

#### Scenario: stale restore cannot relock a completed turn

- **WHEN** a restore request starts before a complete send cycle and returns stale in-flight
  evidence after that cycle has durably committed
- **THEN** the stale response MUST NOT replace the current `idle` state with `running`
- **AND** the Composer MUST remain able to submit the next Turn

#### Scenario: ambiguous recovery locks the whole composer

- **WHEN** the Shared Send state is `cancel-pending` or `recovery-required`
- **THEN** text editing and Turn submission MUST both remain locked
- **AND** another Target MUST NOT bypass the unresolved linear ordering

#### Scenario: recovery probe uses durable owner evidence

- **WHEN** the user selects Probe for a recovery-required Shared Session
- **THEN** an unresolved Attempt MUST be queried by `attemptId`
- **AND** a recovery-only Binding MUST be queried by `bindingKey` before any unlock decision
- **AND** zero/multiple/unknown evidence or an RPC failure MUST keep the Session locked with a
  visible error

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
