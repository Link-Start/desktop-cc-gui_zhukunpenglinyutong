## 1. UI Presentation

- [x] 1.1 [P0][依赖: 无] 在 `GitDiffPanel.tsx` 的 dropdown render boundary 隐藏 `log` selectable option；输入：现有 `modeOptions`；输出：menu 不显示旧 `Git`，但 metadata 与 mode flow 保留；验证：source audit + focused test。
- [x] 1.2 [P0][依赖: 1.1] 将 history quick action icon 改为 `GitCommitHorizontal`；输入：现有 `onOpenGitHistoryPanel` action；输出：只替换 icon，不新增 handler/state；验证：DOM icon class assertion。
- [x] 1.3 [P1][依赖: 无] 将所有 locale 的 `git.historyQuickAction` 统一为 `Git Graph`；输入：10 个 locale 文件；输出：跨语言 technical term 一致；验证：`rg` 无旧 value。

## 2. Regression Coverage

- [x] 2.1 [P0][依赖: 1.1, 1.2, 1.3] 更新 `GitDiffPanel.test.tsx`；输入：现有 Hub callback test；输出：断言 `Git Graph`、`GitCommitHorizontal`、callback once 与旧 `Git` option 不可见；验证：focused Vitest。
- [x] 2.2 [P0][依赖: 2.1] 执行兼容性门禁；输入：完成后的 UI diff；输出：无 mode/callback/backend contract 变更；验证：`pnpm vitest run src/features/git/components/GitDiffPanel.test.tsx`、`npm run typecheck`、`openspec validate refine-git-graph-menu-entry --type change --strict --no-interactive`。

## 3. Sidebar And Visual Consistency

- [x] 3.1 [P0][依赖: 1.2, 1.3] 将 `SidebarSettingsMenu` 的 Git History action 统一为 `GitCommitHorizontal + git.historyQuickAction`；输入：现有 action；输出：仅替换 presentation，不改 callback/active state；验证：Sidebar focused test。
- [x] 3.2 [P1][依赖: 1.2] 为 Git Diff menu 的 `Git Graph` action 增加 scoped modifier；输入：现有 menu item；输出：label `700` weight，label/icon 使用 theme accent；验证：CSS/source assertion。
- [x] 3.3 [P0][依赖: 3.1, 3.2] 更新 focused tests；输入：Sidebar 与 GitDiffPanel 现有测试；输出：锁定统一文案/icon、modifier 与 callback 兼容；验证：Vitest。

## 4. Final Verification

- [x] 4.1 [P0][依赖: 3.3] 执行 lint、typecheck、focused Vitest、large-file sentry 与 OpenSpec strict validation；输入：最终 UI diff；输出：除已知 repository-wide large-file baseline 外无新增门禁问题。
