## REMOVED Requirements

### Requirement: Agent Domain Event Runtime MUST Be Deferred Until A Concrete Consumer Exists

**Reason**: Frontend、diagnostics、future extension and orchestration now require one concrete cross-engine runtime event source.

**Migration**: Replace deferred/no-bus behavior with the private Rust-side bus defined below.

### Requirement: Future Runtime MUST Be In-Memory Only

**Reason**: The authoritative bus must cross the Rust-to-frontend compatibility boundary and support isolated sinks; a frontend-only in-memory runtime cannot own engine provenance.

**Migration**: Keep the core bus in memory while allowing controlled Tauri/frontend and optional persistence sinks.

## ADDED Requirements

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
