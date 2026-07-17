## Context

A streaming-lag audit on the WebKitGTK renderer found the main thread saturated
during response streaming: IPC receive time dominated, one style patch triggered a
~184ms full-document recalc, frame gaps stretched, and CPU pinned above 100%. The
cost was spread across four independent hotspots on the messages path, each doing
per-token or per-frame work that could be cached, coalesced, or offloaded.

## Goals / Non-Goals

- **Goal:** reduce per-token main-thread work and continuous repaint during
  streaming, with zero change to settled rendering or correctness.
- **Goal:** each fix independently shippable and guarded by a fallback.
- **Non-Goal:** the deferred theme-CSS `[data-theme]` / `color-mix()`
  `recalculate-styles` cost (a separate, larger refactor).
- **Non-Goal:** any streaming protocol or event-schema change.

## Decisions

### Decision: Guarded fast-paths, never a pipeline rewrite

Each hotspot gets a narrow fast-path with an explicit fallback to the existing
full computation:

- **History derivations** are cached across ticks; the fast path fires only on a
  detected trailing message-text-only update, else full recompute. This keeps the
  idle result bit-identical to a full scan — the correctness anchor.
- **Snapshot coalescing** is gated by the *existing* `appServerEventDropPolicy`
  (`drop-eligible-snapshot`) — coalescing is only ever applied where the policy
  already permits dropping, so no new correctness surface.

- **Why not a rewrite:** the four hotspots are unrelated in mechanism; a unifying
  renderer would be larger, riskier, and would duplicate engines that already
  exist. Independent fixes are independently reviewable and revertible.

### Decision: Move animation cost to the compositor

Per-frame paints (`background-position` under a text clip, animated
`filter: drop-shadow`) are replaced with `opacity` / static `box-shadow`, which
the compositor can animate without a main-thread repaint. One redundant
`drop-shadow` that merely duplicated an existing `text-shadow` is dropped.

### Decision: Key Bash lines by absolute index

Keying the sliding-window rows by absolute line index (not array position) lets
React reuse DOM rows as the window advances, instead of remounting the visible
list per appended line.

## Risks / Trade-offs

- **Fast-path detection scope:** the history-scan fast path must correctly detect
  "trailing message-text-only update"; a false positive would reuse stale
  derivations. Mitigated by falling back to full recompute for anything else and
  by `events.test.ts` coverage on the coalescing side.
- **Runtime-only proof:** the win is a wall-clock/CPU reduction that unit tests
  cannot assert. This change was authored during a git freeze, so re-recording the
  streaming perf trace on a rebuilt app is a **deferred** manual gate
  (verification.md). The audit that motivated each fix is captured in
  `docs/plans/2026-07-05-chat-scroll-and-streaming-perf-plan.md`.

## Migration

No data/API migration. All changes are internal to `src/features/messages` and
`src/services/events.ts`; settled rendering and the event contract are unchanged.
