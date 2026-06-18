## Context

Current measured evidence:

- `turnStartAckLatencyP95=114ms`
- `firstDeltaLatencyP95=3616ms`
- `postAckFirstDeltaWaitApprox=3502ms`
- visible lag and reducer amplification remain healthy

This narrows the next unknown to the backend ack-after path: after frontend receives `send_user_message` ack, before renderer sees the first assistant delta.

Existing frontend code already parses `params.ccguiTiming` in `noteThreadAppServerEventReceived`, but the Codex backend path does not currently attach phase timing metadata to app-server events.

## Goals / Non-Goals

**Goals:**

- Record Codex backend phase timing without storing content.
- Reuse `ccguiTiming` app-server event metadata so single-event and batched-event paths share the same diagnostics.
- Report `codexPostAckFirstDeltaP95` and phase fields from renderer diagnostics.

**Non-Goals:**

- No provider optimization.
- No Codex protocol changes.
- No prompt/assistant/tool/terminal/file content in diagnostics.
- No changes to provider-scoped runtime selection.

## Decisions

### Decision: store per-turn backend timing in `WorkspaceSession`

Use a bounded map keyed by `threadId` for foreground `turn/start` timing:

- `turnStartRequestStartedAtMs`
- `turnStartResponseReceivedAtMs`
- first stdout event timestamps
- first text delta timestamp

Alternative considered: parse timing only at frontend. Rejected because the frontend cannot know when backend received the `turn/start` response or the first stdout line.

### Decision: attach `ccguiTiming` to app-server event params

When backend emits an event with a `threadId`, enrich `params.ccguiTiming` with content-safe fields. This reuses the existing frontend path.

Alternative considered: emit a parallel diagnostic app-server event. Rejected because it would add a new event type and require separate routing/reporting.

### Decision: only first relevant events carry first-delta phase meaning

The backend can attach timing to any event, but report aggregation will use `stream-latency/app-server-event` diagnostics and focus on entries that have `turnStartResponseToFirstTextDeltaMs`.

Alternative considered: add metrics to `realtime.turnTrace.summary`. Rejected for this step because the summary is renderer-owned and already stable; report can correlate through diagnostics without expanding the turn summary schema first.

## Risks / Trade-offs

- [Risk] Multiple concurrent foreground turns on the same thread could overwrite timing state. → Mitigation: current Codex foreground send path is one turn per thread; state is bounded and terminal events clear the entry.
- [Risk] Some event shapes may lack `threadId`. → Mitigation: only enrich events with resolved `threadId`; unsupported report fields remain explicit.
- [Risk] Extra metadata increases event payload size slightly. → Mitigation: metadata is numeric and bounded; no content fields.

## Migration Plan

1. Add backend timing state and event enrichment.
2. Extend frontend parser to pass new fields into renderer diagnostics.
3. Extend runtime report with post-ack first-delta metrics.
4. Validate with focused Rust/TS/Node tests.

Rollback: remove the metadata enrichment and report fields; event semantics and Codex protocol remain unchanged.

## Open Questions

- If `codexPostAckFirstDeltaP95` remains high after this change, the next phase should split provider request start vs provider first event inside Codex runtime if the protocol exposes that information.
