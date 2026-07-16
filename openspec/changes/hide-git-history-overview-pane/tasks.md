## 1. Three-Column Layout Implementation

- [x] 1.1 [P0][depends:none][I: `GitHistoryPanelView` four-region render tree][O: overview/worktree presentation hidden from visual/accessibility tree and its dedicated separator removed; summary source retained][V: `GitHistoryPanel.test.tsx`; TypeScript compile] 将 Git History 可见布局收敛为三栏。
- [x] 1.2 [P0][depends:1.1][I: surviving `git-history-main-grid`][O: three columns fill the available panel width while existing internal resizers and toolbar summary remain functional][V: focused component/layout assertions] 收敛 CSS 与失效的 overview resize wiring。

## 2. Regression Coverage

- [x] 2.1 [P0][depends:1.2][I: three-column behavior contract][O: regression test proving overview hidden and branch/commit/details visible][V: `npx vitest run src/features/git-history/components/GitHistoryPanel.test.tsx`] 固化三栏结构边界。

## 3. Verification

- [x] 3.1 [P0][depends:2.1][I: completed implementation][O: frontend quality and behavior gates pass][V: focused Vitest; `npm run typecheck`; `npm run lint`; `npm run check:large-files`; `git diff --check`] 执行 frontend 门禁。
- [x] 3.2 [P0][depends:3.1][I: completed OpenSpec change][O: artifacts and implementation remain consistent][V: `openspec validate hide-git-history-overview-pane --strict --no-interactive`] 执行 strict OpenSpec 验证。

## 4. Three-Four-Three Default Ratio

- [x] 4.1 [P1][depends:1.2][I: visible desktop width + two separators][O: branch/commit/details defaults use `3:4:3` with existing minimum guards][V: `getDefaultColumnWidths(1600)` exact assertions] 调整 canonical default width algorithm。
- [x] 4.2 [P1][depends:4.1][I: non-inline CSS fallback][O: fallback desktop grid mirrors `3:4:3`; responsive stacked layout unchanged][V: focused Git History test + stylesheet review] 对齐 CSS fallback。
- [x] 4.3 [P0][depends:4.2][I: completed ratio change][O: frontend and OpenSpec gates pass][V: focused Vitest; typecheck; lint; `git diff --check`; strict OpenSpec validation] 完成增量验证。
