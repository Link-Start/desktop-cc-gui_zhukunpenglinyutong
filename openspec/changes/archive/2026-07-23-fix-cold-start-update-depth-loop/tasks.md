## 1. Regression Attribution

- [x] 1.1 [P0, depends: none] 扩展 `useQuickSwitcherRecentFiles` focused test；输入为等价 workspace identity churn、listener attach 前 storage mutation 与 workspace rename，输出为 bounded publication 和正确 projection，使用 focused Vitest 验证。

## 2. Cold-start Convergence Fix

- [x] 2.1 [P0, depends: 1.1] 将 Quick Switcher hook 的 React state 从 workspace-derived groups 收敛为 normalized storage source snapshot；输出为 `workspaces` 换引用不触发 state setter，使用 hook regression 验证。
- [x] 2.2 [P0, depends: 2.1] 增加有界 workspace catalog semantic stabilization，并保留 mount refresh/storage event counter-case；输出为真实 rename/recent-file change可见，使用 focused Vitest 验证。

## 3. Incremental Verification

- [x] 3.1 [P0, depends: 2.2] 运行 Quick Switcher 与 AppShell startup focused Vitest；输出全部通过且无 React `#185`/act warning。
- [x] 3.2 [P0, depends: 3.1] 运行受影响文件 lint、项目 typecheck 与 production build；输出无新增错误；build 仅保留仓库既有 CSS、dynamic-import 与 chunk-size warnings。
- [x] 3.3 [P0, depends: 3.2] 运行本 change strict OpenSpec validation 并记录验证结果；输出 artifacts 与实现一致。
