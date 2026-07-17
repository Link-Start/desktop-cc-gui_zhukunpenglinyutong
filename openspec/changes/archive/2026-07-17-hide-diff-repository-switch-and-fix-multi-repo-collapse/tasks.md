## 1. Diff 菜单边界

- [x] 1.1 [P1，无前置依赖] 输入现有 Diff mode menu render；移除 `Switch Git repository` 菜单项与仅供该入口使用的 callback，输出不含该 action 且保留 repository selector/scanning props；通过 `GitDiffPanel.test.tsx` 菜单可见性断言验证。

## 2. 多仓库折叠实现

- [x] 2.1 [P1，无前置依赖] 输入 `GitMultiRepositoryChanges` repository groups；新增 repository + section 维度的本地 collapse state，输出 staged/unstaged `DiffSection` 的 `isCollapsed/onToggleCollapsed` contract；通过 `aria-expanded` 和文件行显隐验证。
- [x] 2.2 [P1，依赖 2.1] 输入至少两个 repository 与 staged/unstaged section；补充隔离性与无副作用测试，输出一处折叠不影响其他 section、commit selection 或 Git mutation callback；通过 focused Vitest 验证。

## 3. 质量与规范闭环

- [x] 3.1 [P1，依赖 1.1/2.2] 运行 focused Git component tests 与 `npm run typecheck`，输出全部通过的验证证据。
- [x] 3.2 [P1，依赖 3.1] 校验 OpenSpec artifact 与实现一致性，输出 strict validation、spec sync 与 archive readiness 结果。
