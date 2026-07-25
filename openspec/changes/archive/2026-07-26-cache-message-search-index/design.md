## Context

`computeUnifiedSearchResults` reruns when query changes and calls `searchMessages` for each workspace source. `buildWorkspaceMessageIndex` currently rebuilds identical indexed messages from the same immutable `threadItemsByThread` snapshot on every call. React/thread reducers already publish new object/array references when canonical conversation items change.

## Goals / Non-Goals

**Goals:**

- Reuse the built message index while the canonical snapshot and selected thread ids are unchanged
- Move lowercase normalization into index construction
- Preserve existing synchronous search behavior and result contract

**Non-Goals:**

- Build a persistent, inverted, trigram, or semantic index
- Add a new root state/version counter
- Change result ranking, snippet construction, or provider limits

## Decisions

### 1. Weak snapshot ownership

Use a module-local `WeakMap` keyed by the `threadItemsByThread` object. Each snapshot owns a small `Map` keyed by a stable thread-id signature. The value is the immutable `IndexedMessage[]`.

This uses the existing immutable state boundary as the invalidation signal. When a new canonical snapshot arrives, lookup misses and rebuilds. When the old snapshot becomes unreachable, its cache can be collected without an LRU or explicit cleanup API.

Alternative: cache by `workspaceId + updatedAt`. Rejected because message edits/deletes do not have a proven content-version contract, and timestamps can collide or fail to cover every mutation.

### 2. Normalize once

Add `normalizedText` to each `IndexedMessage`. `searchMessages` uses it for `indexOf`; snippets continue using original `text`.

Alternative: cache lowercase strings separately in the provider. Rejected because it creates a second identity structure and can drift from indexed message invalidation.

### 3. Preserve scan semantics

The query still scans all indexed messages. This change removes repeated build/allocation only; it does not claim sublinear lookup.

## Risks / Trade-offs

- [Risk] A caller mutates `threadItemsByThread` in place → Existing reducer immutability is the cache contract; focused tests lock new-snapshot invalidation
- [Risk] Thread-id signature collision → Use an unambiguous length-prefixed signature rather than delimiter-only join
- [Trade-off] Each live snapshot can cache multiple workspace slices → Search uses a bounded workspace set; WeakMap ownership prevents retention after snapshot release

## Migration Plan

1. Add cache and normalized field behind existing exported builder
2. Update provider to consume normalized text
3. Run focused tests, lint, typecheck, and strict OpenSpec validation

Rollback removes the cache and normalized field; no persisted data or API migration exists.

## Open Questions

None.
