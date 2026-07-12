## Why

Windows users report that dragging the frameless desktop window feels delayed: after pressing in the titlebar region, the pointer can move for a noticeable moment before the window starts moving.

The current Windows titlebar drag fallback waits a fixed 140ms after `mousedown` before calling Tauri `startDragging()`. That delay was added with a fullscreen guard to avoid a prior dual-monitor fullscreen failure, but the fixed timer makes normal drag initiation feel detached from the cursor.

## What Changes

- Replace the fixed Windows drag-start delay with a movement-gated start: record a valid `mousedown`, then call fullscreen-guarded `startDragging()` on the first small pointer movement.
- Preserve click and double-click semantics: ordinary clicks do not start a drag, double-click still toggles maximize/fullscreen recovery behavior, and interactive/no-drag controls remain ignored.
- Keep the fullscreen guard before `startDragging()` so the earlier fullscreen safety fix remains intact.

## Impact

- Frontend hook: `src/features/layout/hooks/useWindowDrag.ts`
- Regression test: `src/features/layout/hooks/useWindowDrag.test.tsx`
- Spec: `windows-titlebar-control-safe-zone`
