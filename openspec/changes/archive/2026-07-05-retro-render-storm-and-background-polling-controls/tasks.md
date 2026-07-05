## Retroactive Implementation

- [x] 代码已经通过既有 commits 落地: `bb74ff52`, `b7ab1e6c`, `fd95f765`, `55e52b88`, `638c56af`。
- 已覆盖实现事实：减少 app-shell root render 对 heavy subtree 的影响。
- 已覆盖实现事实：引入 `useEventCallback` 和 `visibilityGatedInterval`。
- 已覆盖实现事实：将 Composer/status/session 部分状态从 root render storm 中隔离。
- 已覆盖实现事实：virtualizer 改为 remeasure mounted rows，而不是清空 size cache。
- 已覆盖实现事实：修复 CSS containment collapsing scroll viewport。
- [x] 用户确认当前最新代码已经测试，新的功能和优化体验满意。

## OpenSpec Backfill

- [x] 补写 `proposal.md`，以中文为主记录 Why / What Changes / Impact。
- [x] 补写 `design.md`，记录已落地实现背后的设计边界、风险和 guardrails。
- [x] 补写 `specs/render-storm-background-polling-controls/spec.md`，将行为固化为可验证 requirements。
- [x] 补写 `tasks.md`，明确这是 retroactive backfill，不重新改业务代码。
- [x] Run `openspec validate retro-render-storm-and-background-polling-controls --strict --no-interactive`。
