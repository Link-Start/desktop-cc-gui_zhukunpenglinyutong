## MODIFIED Requirements

### Requirement: Active Foreground Work MUST Receive Runtime-Ended Recovery

Runtime lifecycle diagnostics MUST distinguish idle/internal cleanup from runtime termination that affects active or startup-pending foreground work.

#### Scenario: active foreground work still receives runtime-ended recovery
- **WHEN** a Codex managed runtime ends while active turn, pending request, timed-out request, background callback, or foreground work continuity exists
- **THEN** backend MUST preserve enough identity to emit or surface structured recoverable diagnostics
- **AND** frontend recovery surfaces MUST remain able to offer rebind, fresh continuation, or failed outcome according to the identity recovery contract

#### Scenario: just-started Codex thread protects runtime from idle reconcile
- **WHEN** native Codex `thread/start` returns a valid non-empty thread id
- **AND** first-turn readiness or first send has not settled yet
- **THEN** runtime manager MUST record startup-pending foreground work continuity for that thread
- **AND** pool reconcile MUST NOT treat the runtime as idle/evictable until that foreground continuity is cleared or times out

#### Scenario: invalid thread-start response clears foreground work
- **WHEN** native Codex `thread/start` returns no parseable non-empty thread id
- **THEN** backend MUST reject the create-session response
- **AND** any pending Codex foreground work marker for that create attempt MUST be cleared

### Requirement: Codex Create Session Shutdown Race Retry MUST Stay Bounded Across Entrypoints

Codex create-session entrypoints MUST share stopping-runtime race semantics: reject a runtime that is already ending, perform bounded readiness/reacquire behavior where allowed, and settle persistent races as recoverable create-session errors.

#### Scenario: thread-start readiness confirmation is bounded
- **WHEN** `thread/start` returns a valid thread id
- **AND** immediate readiness confirmation reports `thread not found`
- **THEN** backend MUST retry same-runtime `thread/resume` with a finite delay schedule
- **AND** failure after the schedule MUST return a bounded readiness error
- **AND** backend MUST NOT route readiness confirmation to another provider or create a substitute thread
