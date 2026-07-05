## Retroactive Implementation

- [x] 代码已经通过既有 commits 落地: `d0fc3feb`, `5f7ac804`, `f2683bf8`。
- 已覆盖实现事实：消除 streaming text merge 的 O(L^2) 路径。
- 已覆盖实现事实：减少长 conversation streaming 期间 full-history work。
- 已覆盖实现事实：保持 heavy vendors lazy。
- 已覆盖实现事实：在 lightweight streaming / pure code block 场景跳过 heavy-islands 重扫。
- [x] 用户确认当前最新代码已经测试，新的功能和优化体验满意。

## OpenSpec Backfill

- [x] 补写 `proposal.md`，以中文为主记录 Why / What Changes / Impact。
- [x] 补写 `design.md`，记录已落地实现背后的设计边界、风险和 guardrails。
- [x] 补写 `specs/conversation-streaming-merge-performance/spec.md`，将行为固化为可验证 requirements。
- [x] 补写 `tasks.md`，明确这是 retroactive backfill，不重新改业务代码。
- [x] Run `openspec validate retro-conversation-streaming-merge-performance --strict --no-interactive`。
