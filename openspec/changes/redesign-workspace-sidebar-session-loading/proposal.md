## Why

Workspace sidebar loading currently combines active-workspace hydration, idle prewarm, multi-engine source recovery, last-good continuity, and catalog membership. The behavior exists across several contracts, but the missing change artifacts make ownership and acceptance ambiguous and invite root-render polling or blank-list regressions.

## What Changes

- Define a staged hydration model: active workspace first, related owner scopes next, inactive workspaces during idle time.
- Keep foreground thread switching responsive while background catalog hydration runs.
- Preserve engine-scoped last-good continuity under partial sources without widening authoritative membership.
- Add a dedicated `workspace-sidebar-session-loading` capability for orchestration and loading-state semantics.

## Capabilities

### New Capabilities

- `workspace-sidebar-session-loading`: staged hydration, deduplication, stale-result rejection, and foreground responsiveness.

### Modified Capabilities

- `workspace-session-catalog-projection`: catalog hydration remains non-blocking and scope-aware.
- `claude-session-sidebar-state-parity`: Claude continuity survives partial staged hydration.
- `codex-session-sidebar-state-parity`: Codex continuity survives partial staged hydration.
- `sidebar-list-timeout-fallback`: engine-specific snapshots remain isolated during staged hydration.

## Impact

- Documentation scope: sidebar hydration orchestration and its cross-capability contracts.
- Expected implementation surfaces when work resumes: `useWorkspaceThreadListHydration`, `useThreadActions`, catalog adapters, sidebar loading state, and focused tests.
- No production code is changed by this artifact restoration.

