# Verification — optimize-conversation-streaming-render-perf

## Automated (pass now)

- [x] `npm run typecheck` — clean.
- [x] `npx vitest run src/services/events.test.ts` — event coalescing covered
  (added cases for drop-eligible collapse + non-drop-eligible preservation).
- [x] `npx vitest run src/features/messages` — 584 passed / 7 skipped. The 2
  `GenericToolBlock.test.tsx` failures are **pre-existing on base `ea338fae`**
  (verified by running that test on a clean BASE worktree: 2 failed | 24 passed),
  unrelated to this change (the pack does not touch that file).

## 2026-07-18 Calibration

- [x] The implementation pack is present in the current code and the
  coalescing correctness boundary remains covered by `events.test.ts`.
- [x] The standalone rebuilt-app trace is waived because its measurement scope
  was superseded by the shared trace owned by
  `harden-conversation-rendering-for-large-history` and
  `enable-claude-lightweight-streaming-and-frame-attribution`.
- [x] No FPS or CPU improvement is claimed by this waiver; it only prevents
  duplicate manual evidence from keeping an implementation-complete change active.

## Archive Decision

**READY FOR ARCHIVE** — 8/8 tasks complete. Sync the implemented delta specs.

## Notes

- All four fixes are guarded fast-paths with a fallback to the existing full
  computation; the coalescing reuses the existing `appServerEventDropPolicy`.
- This pack is independent of the scroll-owner / jump-controls stack (no shared
  files beyond `Messages.tsx`, which cherry-picked clean onto BASE).
