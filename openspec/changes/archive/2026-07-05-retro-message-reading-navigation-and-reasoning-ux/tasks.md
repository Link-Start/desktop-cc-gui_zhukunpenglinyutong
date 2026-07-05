## Retroactive Implementation

- [x] 代码已经通过既有 commits 落地: `7a71fef5`, `8049be76`, `f763bbf7`, `ee3f050d`, `63e8bd59`, `10bf1125`。
- 已覆盖实现事实：更新 turn boundary presentation。
- 已覆盖实现事实：迭代 user-message anchor rail / outline navigation。
- 已覆盖实现事实：合并 same-segment thinking runs。
- 已覆盖实现事实：为 deferred Claude image 增加 lightbox click behavior。
- [x] 用户确认当前最新代码已经测试，新的功能和优化体验满意。

## OpenSpec Backfill

- [x] 补写 `proposal.md`，以中文为主记录 Why / What Changes / Impact。
- [x] 补写 `design.md`，记录已落地实现背后的设计边界、风险和 guardrails。
- [x] 补写 `specs/message-reading-navigation-reasoning-ux/spec.md`，将行为固化为可验证 requirements。
- [x] 补写 `tasks.md`，明确这是 retroactive backfill，不重新改业务代码。
- [x] Run `openspec validate retro-message-reading-navigation-and-reasoning-ux --strict --no-interactive`。
