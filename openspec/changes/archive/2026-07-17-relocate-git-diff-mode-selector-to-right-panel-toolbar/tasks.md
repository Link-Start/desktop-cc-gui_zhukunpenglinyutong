## 1. Toolbar Target Contract

- [x] 1.1 [P0, depends on: none] 输入现有 `buildRightPanelToolbarNode` 与 active tab contract，输出仅 Git active 时渲染的 leading mount target；验证 non-Git tab 不残留 target 且 normal/swapped ordering 仍由既有 flex contract 驱动。
- [x] 1.2 [P0, depends on: 1.1] 输入 `useLayoutNodes` sibling node composition，输出 instance-local nullable target state 并传入 `GitDiffPanel` optional prop；验证不使用 global DOM query、不新增 dependency。

## 2. Selector Relocation

- [x] 2.1 [P0, depends on: 1.2] 输入现有 mode selector JSX、state、refs 与 callbacks，输出 Portal-to-target + inline fallback；验证 mode/layout/Hub/outside-click/Escape semantics 继续复用原逻辑且 selector 不重复。
- [x] 2.2 [P1, depends on: 2.1] 输入 toolbar/content overflow 与 spacing contract，输出 target/menu visibility 样式及 external selector top-reservation 收敛；验证 narrow/swapped layout 不产生 clipping，worktree apply action 保持原位置与可达性。

## 3. Regression Coverage

- [x] 3.1 [P0, depends on: 2.2] 输入 toolbar target contract，输出 layout focused tests；验证 target 仅随 active Git tab 出现并位于 `PanelTabs` 之前。
- [x] 3.2 [P0, depends on: 2.2] 输入 selector external target contract，输出 `GitDiffPanel` focused tests；验证 target 内唯一 selector、inline fallback、mode/layout/Hub callback 与 worktree action independence。

## 4. Verification

- [x] 4.1 [P0, depends on: 3.1, 3.2] 运行 focused Vitest、`npm run lint`、`npm run typecheck`、`npm run check:large-files` 与 `git diff --check`；输出全部 gate 结果。
- [x] 4.2 [P0, depends on: 4.1] 运行 change-specific strict OpenSpec validation 并审阅最终 diff；输出 spec、implementation 与 regression coverage 一致性结论。

## 5. Review Hardening

- [x] 5.1 [P0, depends on: 4.2] 输入 system WebView compatibility review，输出由 React active state 驱动的 explicit toolbar class；验证 Git menu overlay 不再依赖 CSS `:has()`，non-Git toolbar 继续保留原 overflow boundary。
- [x] 5.2 [P1, depends on: 5.1] 输入 normal/swapped/narrow geometry review，输出 selector open 前的 existing layout measurement reuse；验证首次展开直接采用当前 panel bounds，后续 resize/outside-click/Escape semantics 不变。
- [x] 5.3 [P0, depends on: 5.1, 5.2] 输入兼容性与首开定位 contract，输出 layout/CSS/component focused regression coverage，并重新运行 frontend gates 与 strict OpenSpec validation。
