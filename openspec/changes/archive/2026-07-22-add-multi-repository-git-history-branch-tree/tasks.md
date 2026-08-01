## 1. 规范与数据契约

- [x] 1.1 [P0, 无依赖] 将 repository color slot utility 提升到 Git feature 层；输入为 `GitRepositorySummary[]`，输出稳定 `Map<repositoryRoot, slot>`；用现有 Composer test/typecheck 验证兼容。
- [x] 1.2 [P0, 依赖 1.1] 新增 multi-repository branch catalog hook；输入为 workspace id 与 repository summaries，输出每仓 loading/success/error catalog；用 hook tests 验证 parallel settlement、partial failure 与 stale guard。

## 2. 多仓分支树 UI

- [x] 2.1 [P0, 依赖 1.2] 新增 `GitHistoryMultiRepositoryBranchTree`，渲染 local/remote repository rows、稳定颜色、多仓独立展开与 scoped branches；用 component tests 验证 DOM hierarchy。
- [x] 2.2 [P0, 依赖 2.1] 接入 Git History view：多仓隐藏 toolbar repository picker，branch selection 同步 `repositoryRoot + branchName`；用 `GitHistoryPanel.test.tsx` 验证 graph/worktree/details scope。
- [x] 2.3 [P1, 依赖 2.1] 完成 repository/branch search、row-local loading/error/empty states 与 keyboard accessible labels；用 focused interaction tests 验证。
- [x] 2.4 [P1, 依赖 2.1] 增加 Git History scoped CSS 与全部 locale keys；light/dark theme 使用既有 tokens，单仓 selectors 不变。

## 3. 回归与收口

- [x] 3.1 [P0, 依赖 2.2-2.4] 覆盖 multi-repository complete tree、multi-expand、partial failure、search、scoped selection 与 single-repository parity tests。
- [x] 3.2 [P0, 依赖 3.1] 运行 focused Vitest、changed-file ESLint、`npm run typecheck`、`npm run check:runtime-contracts` 与 strict OpenSpec validation；按用户要求不跑全量 tests。
- [x] 3.3 [P1, 依赖 3.2] 更新 `verification.md` 与 task completion 状态，审查 diff；保留未提交工作区供用户验收。

## 4. 单仓统一树补充

- [x] 4.1 [P0, 依赖 2.1] 单仓复用 repository branch tree，以唯一 repository 解析 `null` / empty-root selection，并保留零 repository legacy fallback。
- [x] 4.2 [P0, 依赖 4.1] 更新 focused component/integration tests，验证单仓 repository row、HEAD、branch selection 与无重复 repository picker。
- [x] 4.3 [P1, 依赖 4.2] 运行相关 Vitest、typecheck、ESLint、runtime/static/large-file contracts 与 strict OpenSpec validation，更新 verification 并保留未提交状态。

## 5. Repository 内 branch 分层折叠

- [x] 5.1 [P0, 依赖 4.1] 复用既有 branch scope helpers，在每个 repository 内渲染 local prefix/root groups 与 remote name groups，并按 exact repository identity 保存展开状态。
- [x] 5.2 [P0, 依赖 5.1] 保持完整 branch selection/context payload，search 临时展开命中 group，当前 local branch group 默认展开。
- [x] 5.3 [P1, 依赖 5.2] 增加紧凑 scoped CSS 与 focused tests，运行相关门禁并更新 verification；不提交。

## 6. Review 收口

- [x] 6.1 [P0, 依赖 5.3] 修复 search 未临时展开 local/remote section、active repository 等价 Set 重建和 catalog unmount stale settlement。
- [x] 6.2 [P0, 依赖 6.1] 保证跨仓 branch context menu 等待 repository identity 切换完成后再开放 action，并补 focused regression test。
