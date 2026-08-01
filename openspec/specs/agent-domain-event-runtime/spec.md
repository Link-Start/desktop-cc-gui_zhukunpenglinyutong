# agent-domain-event-runtime Specification

## Purpose

Defines the authoritative Rust-side runtime bus and compatibility projection contract for agent domain events.

## Requirements

### Requirement: Future Consumers MUST Not Publish Events

If a bus is implemented later, application consumers MUST be able to subscribe but MUST NOT be able to publish.

#### Scenario: publish is not public

- **WHEN** application code imports the runtime event module
- **THEN** no public publish function MUST be available

### Requirement: Reducer Behavior MUST Remain Unchanged If Runtime Emit Is Later Added

Future reducer integration MUST prove next-state equivalence with the current pure reducer path.

#### Scenario: reducer next state is preserved

- **WHEN** future emit-after-mutation integration is tested
- **THEN** the reducer next state MUST equal the pure reducer next state for the same action

### Requirement: Agent Events MUST Enter One Rust-Side Runtime Bus

Every active engine runtime MUST translate protocol output into `MossxAgentEvent` before frontend、diagnostic or persistence fan-out.

#### Scenario: engine emits protocol-specific output

- **WHEN** Codex、Claude or Kimi produces a runtime event
- **THEN** its adapter MUST translate the event once at bus ingress
- **AND** downstream sinks MUST consume the common envelope

### Requirement: Runtime Publish MUST Remain Private And Fan-Out MUST Be Isolated

Only trusted runtime adapters and lifecycle owners MUST publish; application consumers MUST be subscribe-only. A slow or failed sink MUST NOT block engine stdout/stderr readers or another sink.

#### Scenario: noncritical sink stalls

- **WHEN** a diagnostics or persistence sink stops consuming
- **THEN** the engine reader and frontend critical lane MUST continue
- **AND** backpressure/drop diagnostics MUST identify the affected sink

### Requirement: Every Run MUST Settle Exactly Once

The lifecycle owner MUST emit one idempotent `run.settled` after the run reaches completed、failed、cancelled or replaced terminal state.

#### Scenario: duplicate terminal evidence arrives

- **WHEN** an engine emits duplicate or conflicting terminal signals
- **THEN** the bus MUST publish one `run.settled`
- **AND** later terminal evidence MUST be recorded diagnostically without settling again

### Requirement: Frontend Compatibility MUST Preserve Streaming Render Isolation

The frontend sink MUST preserve existing event bridge behavior、batching、critical bypass and `liveAssistantTextChannel`.

#### Scenario: high-frequency text delta arrives

- **WHEN** the bus receives streaming text deltas
- **THEN** frontend projection MUST NOT dispatch every delta into AppShell root state
- **AND** shell/layout consumers MUST not rerender solely because of delta fan-out
