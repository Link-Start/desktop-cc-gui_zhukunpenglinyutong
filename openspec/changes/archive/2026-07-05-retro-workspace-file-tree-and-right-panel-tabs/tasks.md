## Retroactive Implementation

- [x] 代码已经通过既有 commits 落地: `3c8e868e`。
- 已覆盖实现事实：重做 `FileTreePanel`、`FileTreeRows`、`FileTreeRootActions`。
- 已覆盖实现事实：新增 `fileTreeIcons` utility。
- 已覆盖实现事实：right-panel tabs 支持 pinning。
- 已覆盖实现事实：更新 layout nodes 和 panel tabs integration。
- [x] 用户确认当前最新代码已经测试，新的功能和优化体验满意。

## OpenSpec Backfill

- [x] 补写 `proposal.md`，以中文为主记录 Why / What Changes / Impact。
- [x] 补写 `design.md`，记录已落地实现背后的设计边界、风险和 guardrails。
- [x] 补写 `specs/workspace-file-tree-right-panel-tabs/spec.md`，将行为固化为可验证 requirements。
- [x] 补写 `tasks.md`，明确这是 retroactive backfill，不重新改业务代码。
- [x] Run `openspec validate retro-workspace-file-tree-and-right-panel-tabs --strict --no-interactive`。
