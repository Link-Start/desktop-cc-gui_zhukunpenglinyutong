## Context

Desktop file open uses `DesktopLayout` to compose editor, chat companion, and composer placement. Current maximized editor state hides the companion layer but still allows the outer composer to render below `.content`, so the file viewer cannot visually occupy the whole center area. File tabs are currently held as one global `openFileTabs` and `activeEditorFilePath` pair inside `useGitPanelController`, which loses per-workspace continuity during workspace switching.

## Goals / Non-Goals

**Goals:**
- Make desktop editor maximized mode an exclusive center editor surface.
- Keep existing horizontal split behavior: non-maximized editor keeps composer inside the chat companion column.
- Restore open file tabs and active file when switching back to a workspace within the same app session.
- Keep changes local to layout and file-tab state.

**Non-Goals:**
- No persistence across app restart.
- No changes to detached file explorer, phone/tablet layouts, or backend file commands.
- No changes to file document snapshots or editor rendering internals.

## Decisions

1. Layout decision: hide outer composer in maximized editor mode.
   - Chosen: add `!isEditorFileMaximized` to the main-level composer placement condition.
   - Alternative: cover composer with CSS. Rejected because hidden-but-mounted composer can still affect focus and layout semantics.

2. State decision: store file tab sessions per workspace in `useGitPanelController`.
   - Chosen: maintain an in-memory record keyed by workspace id and derive active tabs from the current workspace key.
   - Alternative: persist to client store. Rejected because the requested behavior is workspace switching memory, not restart restore; persistence would add sanitize/migration surface.

3. Closing semantics: close/exit actions only mutate the active workspace's tab state.
   - Chosen: preserve other workspaces' tab memory when the user closes files in the current workspace.
   - Alternative: global clear. Rejected because it recreates the cross-workspace loss.

## Risks / Trade-offs

- [Risk] A workspace without an id cannot be keyed safely. -> Mitigation: fall back to a local singleton key only when no active workspace id exists.
- [Risk] Existing tests encode the old maximized composer behavior. -> Mitigation: update the focused test to assert the corrected contract.
- [Risk] More state indirection could make close fallback harder to reason about. -> Mitigation: keep helper functions pure and local to `useGitPanelController`, with focused tab tests.

## Migration Plan

No data migration. This is runtime UI state only.

Rollback is a revert of the layout condition and workspace-scoped tab state changes.

## Open Questions

None for the requested scope.
