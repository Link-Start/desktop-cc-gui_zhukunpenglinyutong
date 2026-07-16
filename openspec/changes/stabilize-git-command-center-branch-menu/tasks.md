## 1. 状态稳定性（P0）

- [x] 1.1 在 `useGitRepositories` 中保留同 workspace 的单次 last-known-good summary，输入为 normalized aggregate response，输出为不闪空的 repository collection；用 hook test 覆盖 transient empty 与 workspace switch。
- [x] 1.2 校验 AppShell repository selection 不因 transient empty 卸载 branch hook；用 section test 断言 selection/branch scope 连续性。依赖 1.1。

## 2. 分支二级折叠（P0）

- [x] 2.1 为 `ComposerBranchBadge` local/remote scope 增加 keyed expansion state、可访问 toggle 与菜单关闭重置；输入为现有 grouped branches，输出为一层可折叠 scope。
- [x] 2.2 实现非空搜索临时展开匹配 scope且不覆盖用户 preference；用 component test 覆盖 local、remote、search 与清空恢复。依赖 2.1。

## 3. Repository Update 菜单（P0）

- [x] 3.1 精简 FileTree repository Git submenu，删除 Show Diff、Compare Revision、Compare Branch/Tag、Rollback，并加入可用性受 summary 状态约束的 Update。
- [x] 3.2 扩展 typed repository action 与 AppShell wiring，使用显式 `repositoryRoot`、`currentBranch` 调用现有 `updateGitBranch`，并刷新 repository/Git status、展示结构化结果。依赖 3.1。
- [x] 3.3 补齐 FileTree、AppShell/action tests，验证菜单组成、disabled guard、显式 target、pending/result/error；不得新增 backend command。依赖 3.2。

## 4. 质量门禁（P1）

- [x] 4.1 运行 focused Vitest、`npm run typecheck`、`npm run lint`、`npm run check:runtime-contracts`，修复本次变更导致的问题。
- [x] 4.2 运行 `openspec validate stabilize-git-command-center-branch-menu --strict --no-interactive`，复核 spec/task 与实现一致并记录结果。依赖 4.1。
