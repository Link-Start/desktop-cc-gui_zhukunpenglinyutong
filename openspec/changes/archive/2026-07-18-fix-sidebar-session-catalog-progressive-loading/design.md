## Context

The workspace catalog is the membership truth, but first paint must not wait for exhaustive engine history. The client already has cursor, page cap, stale-request, and degraded-source concepts; this change formalizes how they compose for sidebar hydration.

## Goals / Non-Goals

- Goal: bound first-page work and preserve deterministic continuation.
- Goal: keep last-good rows when bounded or degraded evidence cannot prove deletion.
- Non-goal: redesign sidebar visuals or change session membership rules.
- Non-goal: introduce a second catalog outside the shared workspace projection.

## Decisions

### Decision: first page is a bounded projection, not completeness proof

The response carries stable ordering, continuation cursor, and partial/degraded evidence whenever the backend cannot prove exhaustion.

### Decision: continuation preserves the original query contract

Keyword, engine, status, attribution mode, and workspace scope remain stable across pages. A query-generation/request-sequence guard discards late results from older filters.

### Decision: continuity remains evidence-aware

Bounded absence cannot remove last-good in-scope rows. Authoritative archived, deleted, hidden, or out-of-scope evidence still wins.

## Risks / Trade-offs

- Smaller pages improve startup but may delay older-session discovery.
- Preserving last-good rows without source markers can create ghosts; degraded evidence is mandatory.
- Cursor semantics must remain stable across backend and frontend types.

