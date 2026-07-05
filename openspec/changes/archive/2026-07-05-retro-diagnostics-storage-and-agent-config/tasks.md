## Retroactive Implementation

- [x] 代码已经通过既有 commits 落地: `df1e5163`。
- 已覆盖实现事实：隔离 client diagnostics storage/schema。
- 已覆盖实现事实：更新 diagnostics bundle handling。
- 已覆盖实现事实：补齐 Codex debug/dispatch/plan agents config。
- 已覆盖实现事实：新增 OpenSpec consistency validation script。
- 已覆盖实现事实：更新 debug log、kanban、renderer diagnostics tests。
- [x] 用户确认当前最新代码已经测试，新的功能和优化体验满意。

## OpenSpec Backfill

- [x] 补写 `proposal.md`，以中文为主记录 Why / What Changes / Impact。
- [x] 补写 `design.md`，记录已落地实现背后的设计边界、风险和 guardrails。
- [x] 补写 `specs/diagnostics-storage-agent-config/spec.md`，将行为固化为可验证 requirements。
- [x] 补写 `tasks.md`，明确这是 retroactive backfill，不重新改业务代码。
- [x] Run `openspec validate retro-diagnostics-storage-and-agent-config --strict --no-interactive`。
