## Retroactive Implementation

- [x] 代码已经通过既有 commits 落地: `49641b9a`, `a089520d`, `175d6945`, `16e88157`。
- 已覆盖实现事实：移除 Claude `/context` usage probe。
- 已覆盖实现事实：收到 result 后进行 bounded grace settlement。
- 已覆盖实现事实：对 result 后 stderr tail 执行 bounded drain。
- 已覆盖实现事实：对残留 process group 进行 cleanup。
- 已覆盖实现事实：同步加固 frontend realtime turn lifecycle state。
- [x] 用户确认当前最新代码已经测试，新的功能和优化体验满意。

## OpenSpec Backfill

- [x] 补写 `proposal.md`，以中文为主记录 Why / What Changes / Impact。
- [x] 补写 `design.md`，记录已落地实现背后的设计边界、风险和 guardrails。
- [x] 补写 `specs/claude-turn-settlement-stream-lifecycle/spec.md`，将行为固化为可验证 requirements。
- [x] 补写 `tasks.md`，明确这是 retroactive backfill，不重新改业务代码。
- [x] Run `openspec validate retro-claude-turn-settlement-and-stream-lifecycle --strict --no-interactive`。
