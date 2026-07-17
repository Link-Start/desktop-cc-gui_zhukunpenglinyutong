## MODIFIED Requirements

### Requirement: Internal Codex Runtime Shutdown MUST NOT Masquerade As Foreground Turn Loss

The system MUST distinguish expected internal Codex runtime cleanup from true foreground runtime loss before emitting thread-facing runtime-ended diagnostics, including startup-pending continuity created by native `thread/start`.

#### Scenario: internal cleanup without affected work records diagnostics only

- **WHEN** a Codex managed runtime is stopped by internal replacement, stale-session cleanup, settings restart, idle eviction, or app shutdown cleanup
- **AND** there is no active turn, pending request, timed-out request, background thread callback, or foreground work continuity attached to that runtime
- **THEN** the backend MUST NOT emit a `runtime/ended` app-server event for the conversation surface
- **AND** the backend MUST preserve runtime lifecycle evidence in existing runtime diagnostics or ledger state

#### Scenario: active foreground work still receives runtime-ended recovery

- **WHEN** a Codex managed runtime ends while active turn, pending request, timed-out request, background callback, or startup-pending foreground work continuity exists
- **THEN** the affected work MUST settle through a structured recoverable runtime-ended diagnostic
- **AND** the diagnostic MUST preserve enough identity for frontend recovery surfaces to offer rebind, fresh continuation, or failed outcome according to the identity recovery contract

#### Scenario: just-started Codex thread protects runtime from idle reconcile

- **WHEN** native Codex `thread/start` returns a valid non-empty thread id
- **AND** first-turn readiness or first send has not settled yet
- **THEN** runtime manager MUST record startup-pending foreground work continuity for that thread
- **AND** pool reconcile MUST NOT treat the runtime as idle/evictable until that foreground continuity is cleared or times out

#### Scenario: invalid thread-start response clears foreground work

- **WHEN** native Codex `thread/start` returns no parseable non-empty thread id
- **THEN** backend MUST reject the create-session response
- **AND** any pending Codex foreground work marker for that create attempt MUST be cleared

#### Scenario: expected cleanup still settles pending request state

- **WHEN** a Codex runtime end path discovers pending or timed-out request state
- **THEN** every affected request MUST resolve or fail deterministically
- **AND** the system MUST NOT suppress request settlement merely because the shutdown source was expected or internal
