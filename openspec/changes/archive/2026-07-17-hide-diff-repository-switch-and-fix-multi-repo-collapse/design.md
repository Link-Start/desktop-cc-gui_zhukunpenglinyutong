## Context

`GitDiffPanel` owns the Diff mode menu and the single-repository section collapse state. Multi-repository rendering is delegated to `GitMultiRepositoryChanges`, which reuses `DiffSection` but currently omits its `isCollapsed` and `onToggleCollapsed` props. As a result, the shared section header renders a visual chevron without a button contract in multi-repository mode.

Repository scanning and selection are independent capabilities already exposed through callbacks and the existing selector panel. The requested menu cleanup must not remove or alter those contracts.

## Goals / Non-Goals

**Goals:**

- Remove the repository-switch command only from the Diff mode menu.
- Make staged and unstaged sections independently collapsible per repository.
- Preserve existing Git mutation, selection, refresh, and file-open behavior.
- Keep the implementation frontend-local and dependency-free.

**Non-Goals:**

- Removing the repository selector panel or repository scan/select callbacks.
- Persisting collapse state across component mounts or workspace changes.
- Unifying single- and multi-repository presentation state.
- Changing tree topology, commit scope, backend commands, or Tauri payloads.

## Decisions

### Decision: remove menu rendering without deleting repository-selection code

Delete the conditional menu fragment that renders the separator and `Switch Git repository` item. Remove its now-dead menu-only callback if it has no remaining callers.

Alternative considered: gate the item behind a new feature flag or prop. Rejected because the requested behavior is unconditional and a new configuration surface would add unsupported states.

Compatibility rule: existing scan/select/clear props and the repository selector panel remain unchanged.

### Decision: keep collapse state inside `GitMultiRepositoryChanges`

Store collapsed keys in a local `Set<string>`. Build each key from `workspaceId`, the exact `repositoryRoot`, and `staged` or `unstaged`, then pass membership/callbacks through the existing `DiffSection` contract.

Alternative considered: lift all section state into `GitDiffPanel`. Rejected because it increases prop and state coupling between single- and multi-repository modes without a shared lifecycle requirement.

### Decision: serialize composite keys with an unambiguous representation

Reuse the existing repository/path key pattern and encode `[workspaceId, repositoryRoot, section]` with `JSON.stringify`. This avoids delimiter collisions for valid filesystem paths and prevents same-root state leakage when the component receives another workspace.

Alternative considered: concatenate strings with `:`. Rejected because Windows paths and repository names may contain the delimiter.

### Decision: collapse remains presentation-only

Collapsed sections stay mounted only at the section component boundary already defined by `DiffSection`; selection data remains derived from repository status and `selectionOverrides`. Toggle handlers do not call stage, unstage, refresh, or selection callbacks.

## Risks / Trade-offs

- [Risk] Repository status refresh removes a section while its key remains in local state → The stale key has no visible consumer and is harmless; avoid an effect solely for cleanup.
- [Risk] Tests could verify only one repository and miss state leakage → Cover two repositories and both section types with independent `aria-expanded` assertions.
- [Risk] Removing the menu callback may accidentally remove selector capability → Limit deletion to menu-only rendering/callback and retain all public props and selector-panel code.
- [Trade-off] Collapse state resets on remount → This is intentional presentation state and avoids persistence compatibility concerns.

## Migration Plan

1. Update the behavior delta and focused tests.
2. Remove the Diff menu item and menu-only callback.
3. Add local multi-repository collapse state and connect existing props.
4. Run focused Vitest, typecheck, and strict OpenSpec validation.

Rollback is a direct revert of the focused frontend/test/spec changes. No data migration or backend rollback is required.

## Open Questions

None. The requested visibility and interaction boundaries are explicit.
