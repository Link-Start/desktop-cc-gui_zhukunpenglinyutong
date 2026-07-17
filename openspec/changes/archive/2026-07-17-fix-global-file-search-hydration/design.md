## Context

`useWorkspaceFiles` intentionally loads shallow root children for file-tree first paint. Composer `@` completion compensates for that by fetching and caching `getWorkspaceFiles(workspaceId)` when an unscoped query needs nested candidates. Search currently copies shallow `files[]` into `globalSearchFilesByWorkspace` and treats key presence as complete hydration, while discarding `scan_state`、`limit_hit` 与 `sourceVersion`。

This creates two failures:

1. active-workspace search never requests a full snapshot;
2. global search skips active workspace hydration after a shallow or empty array was cached.

## Goals / Non-Goals

**Goals:**

- Search nested workspace paths in both active and global scope.
- Keep immediate shallow results while full hydration runs.
- Reuse in-flight/completed snapshots and bound cross-workspace concurrency.
- Preserve partial/error state and reject stale async results.

**Non-Goals:**

- No backend command or scan-budget changes.
- No full scan on every query.
- No new global indexing service or search ranking redesign.
- No file-tree loading behavior changes.

## Decisions

### Decision 1: Typed cache entries instead of `string[]`

Search orchestration stores:

```ts
type WorkspaceSearchFileSnapshot = {
  files: string[];
  status: "shallow" | "loading" | "complete" | "partial" | "error";
  sourceVersion: string | null;
  error: string | null;
};
```

Alternative: keep `Record<string, string[]>` plus a separate hydrated-id set. Rejected because parallel state can drift and still loses partial/error/source-version evidence.

### Decision 2: Shallow state is immediate but never authoritative

The active workspace `files` array updates a `shallow` entry only when no full/partial snapshot already exists. Search can use these candidates immediately, but opening a file-capable search scope schedules full hydration.

Alternative: ignore shallow candidates until full hydration completes. Rejected because it creates unnecessary empty-state flicker and delays root-file matches.

### Decision 3: One bounded hydration path for both scopes

When the palette is open and `all` or `files` is selected:

- active scope targets only the active workspace;
- global scope targets all workspaces;
- active workspace is first;
- at most two requests run concurrently;
- `loading` entries prevent duplicate in-flight requests.

Completed/partial snapshots are reused across queries. Error entries remain retryable on the next qualifying palette lifecycle.

### Decision 4: Preserve response completeness metadata

`scan_state === "partial"` or `limit_hit === true` produces `partial`; otherwise the entry is `complete`. The search surface receives an aggregate hydration state and renders a non-blocking incomplete/error notice instead of a definitive zero-result message.

Alternative: silently search returned files. Rejected because it violates `search-hydration-complement` and misrepresents incomplete coverage.

### Decision 5: Stale writes are generation-guarded

Each hydration effect owns a generation/cancellation boundary. A closed palette, scope/workspace change, or newer request prevents older responses from committing.

## Risks / Trade-offs

- [Risk] Full snapshots can still be bounded at 12,000 entries. → Preserve `partial` and communicate incomplete coverage.
- [Risk] Global scope may scan several workspaces. → Active-first queue, concurrency limit two, completed cache reuse.
- [Risk] Error retry can repeat expensive failures. → Retry only on a later qualifying palette lifecycle, never per keystroke.
- [Risk] Typed state touches multiple props. → Keep the type feature-local and modify only search orchestration/presentation boundaries.

## Migration Plan

1. Replace the palette cache state type and shallow seeding behavior.
2. Unify active/global full-snapshot hydration.
3. Derive aggregate hydration state and expose it to the palette.
4. Add focused regression tests.
5. Run focused Vitest, typecheck, lint and strict OpenSpec validation.

Rollback is localized: restore the previous cache type and hydration effect. No persisted data or backend contract requires migration.

## Open Questions

None. Full-text/code-content search remains outside this file-name hydration fix.
