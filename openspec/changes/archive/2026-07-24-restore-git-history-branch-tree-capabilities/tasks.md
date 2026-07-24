## 1. Capability Regression Coverage

- [x] 1.1 [P0] 基于现有 branch catalog fixtures 补 focused component test，输入 single/multi repository local/remote branches，验证 `All Branches` repository scope、root/current default expansion、current emphasis、`HEAD`、special 与 ahead/behind badges；输出可失败的 regression coverage。（依赖：无；验证：focused Vitest）

## 2. Canonical Tree Restoration

- [x] 2.1 [P0] 在 `GitHistoryMultiRepositoryBranchTree` 复用既有 helper/CSS 恢复 old navigator projection；输入现有 `GitBranchListItem` catalog，输出 single/multi repository 一致的 navigation/status affordances。（依赖：1.1；验证：focused Vitest）
- [x] 2.2 [P1] 对照 capability matrix 复核 search、repository/group expansion、exact branch identity 与 context menu 未回退。（依赖：2.1；验证：focused component/integration tests）

## 3. Quality Gates

- [x] 3.1 [P0] 运行 focused Vitest、`npm run typecheck`、`npm run lint` 与 `openspec validate restore-git-history-branch-tree-capabilities --strict --no-interactive`，记录所有结果。（依赖：2.2；输出：可复核 validation evidence）
