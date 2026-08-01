## MODIFIED Requirements

### Requirement: Shared Session Hidden Native Bindings Stay Internal

Native bindings owned by a `shared session` are runtime internals and MUST NOT become user-facing native conversations. This rule applies to every Shared-supported engine (`Claude`, `Codex`, `Kimi`, `Grok`, `OpenCode`), not only `Claude` / `Codex`.

#### Scenario: selector change does not create a visible native conversation

- **WHEN** the user switches selected engine inside a `shared session` but has not sent a new turn
- **THEN** the system MUST persist the shared selector state for that session
- **AND** the system MUST NOT create an extra user-visible native conversation only because of that selector change

#### Scenario: shared-owned native bindings are filtered from native list surfaces

- **WHEN** thread list / tabs / reopen flows include both native sessions and shared sessions
- **THEN** native bindings marked as shared-owned internals MUST remain hidden from native conversation surfaces for Claude, Codex, Kimi, Grok, and OpenCode
- **AND** users MUST continue the conversation through the `shared session` identity

#### Scenario: grok shared binding does not appear as native sidebar row

- **WHEN** a Shared Session turn executes on Grok and materializes a Hidden Native Binding
- **THEN** the thread list MUST NOT show a separate Grok native row for that binding
  (including sessions whose first message is a context-package marker)
- **AND** the only user-facing conversation row for that work MUST remain the `shared:*` identity

#### Scenario: kimi and opencode shared bindings stay hidden after real id finalizes

- **WHEN** a Shared Session turn executes on Kimi or OpenCode and the runtime later finalizes a real native session id
- **THEN** the durable binding MUST be updated to that real identity
- **AND** subsequent thread list / catalog merges MUST hide that native id from user-facing native surfaces

### Requirement: Shared Pending Rebinding Is Safe And Deterministic

Pending placeholder rebind for shared/native bridge MUST avoid stale or ambiguous mappings, and MUST cover every Shared-supported engine that can finalize a native session id after send.

#### Scenario: pending rebind uses unique fresh placeholder

- **WHEN** runtime events arrive for a shared turn whose native thread id finalized after send
- **THEN** the bridge MUST rebind through a unique pending placeholder for the same workspace/engine
- **AND** subsequent turn events MUST route to the same shared thread identity

#### Scenario: pending rebind covers all shared engines

- **WHEN** a Shared Session pending binding exists for Claude, Codex, Kimi, Grok, or OpenCode
- **AND** a `thread/started` (or equivalent identity finalization) event arrives for that engine
- **THEN** the bridge MUST be allowed to rebind that engine's pending placeholder to the finalized native thread id
- **AND** the system MUST NOT limit this rebind path to Claude/Codex only

#### Scenario: stale or ambiguous pending placeholders are ignored

- **WHEN** multiple pending placeholders exist or the pending placeholder is stale
- **THEN** the bridge MUST reject fallback rebind for that event
- **AND** the system MUST avoid assigning that event to an unrelated shared conversation
