## ADDED Requirements

### Requirement: Shared Recovery Presentation MUST Have One Durable Owner

Shared Session recovery UI MUST be derived from the Shared Attempt/Binding state machine.
Conversation Canvas reuse MUST NOT activate Native Session reconnect actions for a Shared thread.
Native Session reconnect presentation MUST remain unchanged.

#### Scenario: shared runtime diagnostic does not create native recovery card

- **WHEN** a Shared thread contains a diagnostic that matches the Native runtime reconnect classifier
- **THEN** the Conversation Canvas MUST NOT render `RuntimeReconnectCard` for that diagnostic
- **AND** rebind, resend, or Native fork actions MUST NOT become available through that row

#### Scenario: shared recovery remains available through attempt owner

- **WHEN** durable Shared evidence resolves to `recovery-required`
- **THEN** `SharedSendStatusBar` MUST remain the visible recovery surface
- **AND** its Probe or explicit rebuild action MUST operate on the durable Attempt/Binding owner

#### Scenario: native reconnect behavior remains unchanged

- **WHEN** the same reconnect diagnostic belongs to a Native thread
- **THEN** the existing Native reconnect card and actions MUST remain available

### Requirement: Degraded Context Confirmation MUST Be Localized And Structured

The degraded-context gate MUST remain visible before any lossy context or prompt side effect.
Its primary summary and actions MUST use locale resources. Protocol details MUST be projected from
structured Manifest fields instead of concatenated backend display strings; known mode, omission
category/reason, disposition, outcome, and token labels MUST be localized.

#### Scenario: Chinese degraded summary explains portable behavior

- **WHEN** the active locale is Simplified or Traditional Chinese and a package has omissions
- **THEN** the primary summary MUST explain that compatible conversation content will still be sent while incompatible or private content cannot be transferred
- **AND** it MUST NOT expose known English protocol vocabulary such as `omissions`, `estimated tokens`, or `not-retrievable`

#### Scenario: continue and cancel actions remain explicit

- **WHEN** the composer enters `degraded-context`
- **THEN** the localized Continue and Cancel actions MUST remain visible
- **AND** no context or prompt side effect may occur until Continue is explicitly selected

#### Scenario: technical details are disclosed on demand

- **WHEN** the user opens degraded-context details
- **THEN** the UI MUST show localized projection mode, each structured omission, disposition, and token estimate
- **AND** an unknown protocol value MUST remain visible as a diagnostic fallback rather than being dropped or guessed

### Requirement: Same-Binding Continuation MUST NOT Behave Like Context Migration

Canonical facts already owned by the destination Native Binding MUST remain auditable as
`destination-owned`, but MUST NOT count as lossy context or require user confirmation. A package
with no portable delta MUST NOT inject an empty transcript marker or wait for a replay checksum.

#### Scenario: same target continues without degraded confirmation

- **WHEN** consecutive Shared turns use the same CLI, Provider, and Native Binding
- **AND** all source facts are already owned by that destination
- **THEN** context preparation MUST return `ready`
- **AND** the composer MUST NOT render the degraded-context confirmation

#### Scenario: zero-delta delivery preserves native continuation

- **WHEN** a prepared package has no portable entries
- **THEN** its `promptPrefix` MUST be empty
- **AND** the runtime MUST receive only the current user request
- **AND** context acceptance MUST use auditable `no-context-transfer-required` evidence without waiting for a checksum echo

#### Scenario: real loss remains gated

- **WHEN** the same package also contains an omission that cannot be reconstructed at the destination
- **THEN** the degraded-context confirmation MUST remain required
- **AND** benign `destination-owned` entries MUST NOT be presented as lost content

### Requirement: Shared Native Runtime Ownership MUST Precede Visible Fan-out

Native session identity MUST use one engine-specific canonical representation at the Runtime
coordinator boundary. A new Codex Native thread created for Shared dispatch MUST be held before
`thread/started` fan-out and MUST only be projected after exact Attempt binding.

#### Scenario: raw Claude UUID matches durable binding

- **WHEN** a Claude Runtime event reports raw session UUID `x`
- **AND** the durable Shared Binding identity is `claude:x`
- **THEN** the event MUST resolve to that Binding and Attempt
- **AND** terminal settlement MUST retain `claude:x` as the canonical native identity

#### Scenario: Claude providers remain isolated

- **WHEN** two Claude Providers emit the same raw session UUID
- **THEN** each event MUST resolve only inside its exact provider runtime scope
- **AND** neither Provider may settle or label the other Provider's Attempt

#### Scenario: first Codex turn stays hidden from native catalog

- **WHEN** Shared dispatch creates a Codex thread with no prior Native Binding
- **THEN** the provider-scoped provisioning owner MUST defer its `thread/started` fan-out
- **AND** exact binding MUST project that event to the Shared thread
- **AND** `list_shared_sessions` MUST include the V2 Binding native identity in its catalog exclusion projection
- **AND** no ordinary Native Session entry may be created for the hidden Binding before or after Sidebar refresh

#### Scenario: legacy metadata is not the hidden-binding authority

- **WHEN** a Shared V2 Binding exists in `shared_binding_state` but not in V0 `bindings_by_engine`
- **THEN** catalog exclusion MUST still hide its Native Session
- **AND** V0 metadata MAY only contribute compatibility identities, not replace V2 Binding state

### Requirement: Missing Native Binding MUST Enter Typed Recovery

A definitive Native session-not-found response MUST terminalize the current Attempt exactly once,
mark the affected Binding `recovery-required`, and return a typed recovery result. It MUST NOT be
shown as raw Provider diagnostics or trigger automatic retry, Provider fallback, or silent rebuild.

#### Scenario: stale Claude binding is recoverable

- **WHEN** Claude reports `No conversation found with session ID`
- **THEN** the current Attempt MUST have one failed canonical terminal
- **AND** its Binding MUST become `recovery-required` with reason `native-session-not-found`
- **AND** the Shared recovery status bar MUST be the only visible recovery surface

#### Scenario: terminal event races response error

- **WHEN** a failed Runtime terminal is committed before the command response exposes the same failure
- **THEN** the response path MUST reuse that terminal evidence
- **AND** it MUST NOT append a conflicting second `conversation.turnCommitted`

#### Scenario: recovery failure is not exposed as provider prose

- **WHEN** the typed Binding recovery result reaches the client
- **THEN** the send orchestrator MUST return `recovery-required` without throwing a raw error row
- **AND** all user-facing recovery actions and status text MUST use locale resources
