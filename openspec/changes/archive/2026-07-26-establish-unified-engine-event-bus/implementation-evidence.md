# Implementation Evidence

## Runtime owner

- `AgentEventBus` owns sequence, immutable `MossxAgentEvent` envelope, private
  publish, bounded normal queues, non-blocking delta coalescing and an
  unbounded critical lane.
- `run.settled` accepts `completed`、`failed`、`cancelled`、`replaced`; duplicate
  or conflicting terminal evidence increments diagnostics and is not
  republished.
- Claude、Kimi、Gemini and gated OpenCode daemon forwarders enter the bus before
  the existing AppServer compatibility projection. Codex mapping parity is
  covered by the common `EngineEvent` shadow adapter test and remains on its
  native AppServer ingress until the adapter protocol batch.
- `MOSSX_AGENT_EVENT_BUS_ENABLED=0` disables bus ingress as the rollback switch.

## Frontend compatibility and render boundary

- Domain event schema now includes the eleventh event, `run.settled`, plus
  logical session、run、engine and provenance projections.
- Existing `realtimeEventBatcher` and `liveAssistantTextChannel` remain the
  streaming path. No root hook or reducer receives per-delta bus updates.
- Existing AppServer projection remains the compatibility sink after bus
  ingress, so the frontend receives one delivery rather than old/new duplicate
  deliveries.

## Verification

- focused Vitest: domain factories/runtime/derivation/governance、thread event
  handlers、realtime batcher、live text channel.
- focused Rust: `engine::agent_event_bus::tests`.
- `cargo check --bin cc_gui_daemon`.
- `pnpm tsc --noEmit --pretty false`.
