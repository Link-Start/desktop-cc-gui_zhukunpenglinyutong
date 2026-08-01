## Context

`FileViewPanel` renders the shared file content menu, while `FileTreePanel` owns expansion and selection state. In the main window both are composed by `useLayoutNodes`; in detached explorer they are siblings under `FileExplorerWorkspace`. There is no current intent channel from the viewer to the tree. Detached sessions must remain independent, and root-level render state must stay bounded.

## Goals / Non-Goals

**Goals:**

- Add a localized content-menu action that reveals the active file in the colocated file tree.
- Reuse `FileTreePanel`'s existing expansion and selection setters.
- Support repeated requests for the same path.
- Preserve main/detached session boundaries and existing file behavior.

**Non-Goals:**

- No backend command, persistence, global store, fuzzy lookup, or Finder integration.
- No file tab menu change.
- No new visual styling beyond the existing `RendererContextMenu` contract.

## Decisions

### Decision: pass a monotonic reveal request through the nearest shared owner

Introduce a small request shape containing normalized `path` and monotonic `requestId`. `FileViewPanel` emits the target path. `useLayoutNodes` and `FileExplorerWorkspace` create a new request, then pass it to their colocated `FileTreePanel`.

This is preferred over global state because the action is ephemeral, and detached windows own independent browsing sessions. A monotonic id is preferred over a bare path because selecting the same menu item twice must trigger scrolling twice.

### Decision: keep tree mutation inside `FileTreePanel`

`FileTreePanel` remains the single owner of `expandedFolders`, `selectedNodePath`, `selectedNodePaths`, and `selectedNodeType`. On each request it normalizes the path and derives every ancestor by splitting `/`. It expands only ancestors present in the current tree snapshot. When a lazy directory response adds the next ancestor, the same request is reevaluated and continues the existing lazy-load chain until the target appears, then applies single selection.

This reuses existing state and lazy loader rather than adding a parallel controlled-selection model, timer, backend API, or file-type branch. The derivation is O(depth), not O(tree size), and works for any file name or extension.

### Decision: identify the target row with a DOM-safe data attribute

Each file row exposes its canonical relative path through `data-file-tree-path`. After expanded rows render, an effect locates the exact row under `fileTreeListRef` and calls `scrollIntoView({ block: "nearest" })`. Lookup uses a predicate over rendered rows instead of interpolating the path into a CSS selector, avoiding escaping bugs for quotes and special characters.

### Decision: surface owners restore tree visibility

The main owner switches `filePanelMode` to `files` before issuing the request. Detached explorer clears `sidebarCollapsed`. The request remains present while the tree mounts, so the consumer can process it on first render.

## Data Flow

```text
FileViewPanel content menu
  -> onRevealInFileTree(filePath)
  -> owner restores tree surface and increments requestId
  -> FileTreePanel receives revealRequest
  -> expand ancestors + select target
  -> rendered target row scrolls into nearest visible position
```

## Error Handling

- Empty paths are ignored.
- A target absent from the current rendered snapshot keeps the request active while known lazy ancestors load progressively; no exception or filesystem mutation occurs.
- Normalized relative paths are compared as data values, not executable selectors.
- Existing lazy-load failures remain visible through the current directory retry UI; reveal adds no parallel request path or silent error handling.

## Risks / Trade-offs

- [Risk] Virtualized or lazy tree rows may not exist immediately after expansion. → Reveal expands only currently known ancestors and reevaluates as each lazy response extends the tree; the scroll effect runs after the target enters the visible-row projection.
- [Risk] Main right panel is hidden or on another mode. → Owner switches to `files` before updating the request.
- [Risk] Repeated same-path actions are deduplicated by React state. → Increment `requestId` for every invocation.
- [Trade-off] Each owner adds small wiring. → Avoids a persistent global intent bus and preserves detached isolation.

## Migration Plan

1. Add the optional callback/request contracts without changing existing callers.
2. Wire main and detached owners.
3. Add focused tests, then validate lint/typecheck/OpenSpec.
4. Rollback by removing the optional props and menu item; no data rollback is needed.

## Open Questions

- None. The user-confirmed scope is the file content context menu only.
