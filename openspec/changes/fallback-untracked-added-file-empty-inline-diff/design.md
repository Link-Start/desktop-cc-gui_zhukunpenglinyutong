## Context

`GenericToolBlock` currently maps any non-empty `diffText` to `canExpand=true` and only supplies `onOpenDiffPath` when `diffText` is absent. `FileChangeRow` lazily parses on expansion, but a non-empty payload can still yield zero renderable edit lines. In that state the row renders an empty body and the canonical Git navigation has already been removed. The Git backend already includes untracked content, so the missing behavior is entirely in the message interaction layer.

## Goals / Non-Goals

**Goals:**

- Keep valid inline preview as the first-priority path.
- Let normalized `added` rows fall back to canonical Git diff when lazy parsing produces no visible edit lines.
- Preserve folded-state lazy parsing and isolate optional navigation failures.

**Non-Goals:**

- No backend, IPC, persistence, or Git model changes.
- No disk reads from the conversation renderer.
- No behavior expansion to modified/deleted/renamed rows.
- No reinterpretation of historical event stats from current workspace state.

## Decisions

### Decision 1: Resolve the branch at activation time

`FileChangeRow` will distinguish three states without pre-parsing while collapsed: no inline loader, loader returning visible edit lines, and loader returning no visible edit lines. For an added row, the caller supplies the existing optional `onOpenDiffPath`; the row invokes it only in the first and third states.

Alternative: pre-parse in `GenericToolBlock`. Rejected because it makes every collapsed row pay diff parsing cost and violates the established lazy guard.

### Decision 2: Renderability means at least one add/del/context line

The existing preview adapter marks metadata and hunk headers separately. A preview containing only headers is not useful content and MUST use canonical fallback. Context-only preview remains renderable because it can carry meaningful unchanged lines around an edit supplied by provider-specific formats.

Alternative: treat any parsed line as renderable. Rejected because metadata-only patches reproduce the empty body after the renderer filters hunk rows.

### Decision 3: Keep semantic gating in `GenericToolBlock`

Only normalized `added` entries receive the callback. `FileChangeRow` remains change-kind agnostic and merely executes an explicitly supplied missing-preview action.

Alternative: enable fallback for every row. Rejected because it changes existing modified/deleted/renamed missing-diff behavior and broadens the contract.

## Risks / Trade-offs

- [Risk] The Git diff list may not yet contain the untracked path at click time. → Reuse the existing navigation state and Git refresh lifecycle; do not synthesize data in the row.
- [Risk] A provider emits context-only content that is technically parseable but not useful. → Keep current parser semantics in this narrow fix; focused tests lock the metadata-only failure that caused the empty body.
- [Trade-off] The first click on an unrenderable inline payload navigates instead of briefly expanding. → This avoids a dead-end surface and matches the canonical fallback contract.

## Migration Plan

1. Extend the optional callback wiring for normalized added rows.
2. Resolve preview vs fallback inside the existing lazy row activation.
3. Add focused tests and run frontend/OpenSpec gates.

Rollback: revert the two component changes and tests. No data migration or backend rollback is required.

## Open Questions

无。
