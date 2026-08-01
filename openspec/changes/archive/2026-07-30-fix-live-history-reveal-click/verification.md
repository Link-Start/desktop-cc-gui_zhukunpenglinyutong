# Verification

## Automated

- `npx vitest run src/features/messages/orchestration/presentation/messagesLiveWindow.test.ts src/features/messages/components/Messages.live-behavior.test.tsx --maxWorkers 1 --minWorkers 1`
  - Result: 2 files passed, 76 tests passed.
  - Regression proof: before the implementation change, the helper assertion failed and the live click test timed out; both pass after restoring the show-all branch.
- `npm run typecheck`
  - Result: passed.
- `npm run lint`
  - Result: passed with 8 pre-existing warnings outside the changed files and zero errors.
- `openspec validate fix-live-history-reveal-click --strict --no-interactive`
  - Result: passed.
- `git diff --check`
  - Result: passed.

## Scope Review

- `buildLiveTailWorkingSet()` has one production caller in `MessagesCore.tsx`.
- Default collapsed streaming still uses `STREAMING_VISIBLE_WINDOW`.
- Explicit show-all returns the original full item list and zero omitted count.
- No backend, IPC, storage, dependency, or migration changes.
