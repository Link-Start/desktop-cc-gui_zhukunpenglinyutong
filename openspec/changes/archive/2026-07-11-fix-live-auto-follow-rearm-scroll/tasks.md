## 1. Implementation

- [x] 1.1 [P1] Update `Messages` live controls event handling so `liveAutoFollowEnabled: true` re-arms `autoScrollRef` and scrolls the current bottom sentinel. Input: existing `MESSAGES_LIVE_CONTROLS_UPDATED_EVENT`; Output: current viewport returns to latest output.

## 2. Verification

- [x] 2.1 [P1] Add a focused `Messages.live-behavior.test.tsx` regression for scroll-away -> re-enable focus follow -> bottom scroll. Depends on 1.1; Output: failing-before/passing-after behavior coverage.
- [x] 2.2 [P1] Run `openspec validate --changes fix-live-auto-follow-rearm-scroll --strict` and focused Vitest for message behavior. Depends on 1.1 and 2.1; Output: validation result recorded in final response.
