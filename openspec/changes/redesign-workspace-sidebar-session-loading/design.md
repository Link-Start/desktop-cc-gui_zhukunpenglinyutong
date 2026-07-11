## Context

Hydrating every workspace and every engine at startup competes with foreground rendering and can convert partial source failures into blank lists. Current code already exposes active-workspace phases, idle scheduling, request sequencing, full-catalog/session-radar kinds, and last-good source snapshots. The design consolidates these into one explicit state machine.

## Goals / Non-Goals

- Goal: prioritize the active workspace without serially blocking the rest of the shell.
- Goal: deduplicate per-workspace hydration and reject stale results.
- Goal: preserve source health and last-good continuity per engine.
- Non-goal: change catalog membership, archive filters, or folder organization semantics.
- Non-goal: add high-frequency root polling.

## Decisions

### Decision: hydrate by explicit phase

Phases are `active-workspace`, `related-owner-scope`, `idle-prewarm`, and `on-demand`. Active work is scheduled first; inactive work is chunked through the existing render scheduler/idle path.

### Decision: one in-flight hydration per workspace and query generation

Loading and in-flight sets prevent duplicate work. Request sequence/query identity rejects late completion from an older refresh without marking it fully hydrated.

### Decision: loading state distinguishes continuity from completeness

Existing rows may remain visible during refresh. The UI exposes loading/degraded state separately; a partial result cannot masquerade as complete or clear last-good rows.

### Decision: engine snapshots are independent

A degraded Claude source cannot block a healthy Codex snapshot, and vice versa. Authoritative deletion and scope filters are applied before continuity seeding.

## Risks / Trade-offs

- Idle prewarm improves startup responsiveness but makes completion timing nondeterministic.
- Incorrect “fully hydrated” bookkeeping can suppress required retries.
- Cross-workspace owner scope requires stable identity; path heuristics must not silently widen membership.
- Root render performance must be checked because hydration state changes can fan out through AppShell.

