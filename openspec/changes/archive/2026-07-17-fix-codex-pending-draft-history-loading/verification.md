# Verification: fix-codex-pending-draft-history-loading

## Status

**READY FOR ARCHIVE** — 4/4 tasks complete.

## Confirmed Evidence

- Focused Layout, Messages history-loading, and thread sidebar-cache regressions are recorded as complete in `tasks.md`.
- `src/features/layout/hooks/useLayoutNodes.tsx` derives the active presentation state from `historyLoadingByThreadId`.
- The focused Layout regression covers a fresh `codex-pending-*` draft without restoring-history presentation.
- `npm run typecheck` exited `0` on 2026-07-17.
- Strict change validation exited `0` on 2026-07-17.

## Archive Decision

Implementation, regression, TypeScript, and strict OpenSpec gates are complete. Ready to sync and archive.
