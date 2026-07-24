## 1. Shared Line Stats Badge

- [x] 1.1 [P0, 无依赖] 在 `GitDiffPanelFileSections.tsx` 新增 `renderSectionLineStatsBadge(additions, deletions)` helper；输入为非负整数，输出与 per-file `diff-counts-inline git-filetree-badge` 相同 className + `is-add` / `is-sep` / `is-del` 子元素；当两者均为 0 时返回 `null`；以 focused unit test 验证零值隐藏、非零渲染与子元素顺序。

## 2. Single-Repo Section Header

- [x] 2.1 [P0, 依赖 1.1] 在 `DiffTreeSection` 内部 `useMemo` 聚合 `files.additions` / `deletions` 之和；在 `renderSectionCountBadge(files.length)` 之前渲染 `renderSectionLineStatsBadge(...)`；以 component test 验证 staged / unstaged header 同时渲染 line stats 与 file count 徽章。
- [x] 2.2 [P0, 依赖 1.1] 在 `DiffSection` 重复 2.1 改动；以 component test 验证 flat 视图 header 同步行为。

## 3. Multi-Repo Per-Repo Header

- [x] 3.1 [P0, 依赖 1.1] 在 `GitMultiRepositoryChanges.tsx` 的 `git-repository-change-group__count` 内部，在 `t("git.filesChanged", { count })` 文案前渲染 `+n-m` 徽章（数据来自 `status.totalAdditions` / `totalDeletions`）；以 component test 验证零值隐藏、非零显示。

## 4. Test Adjustments

- [x] 4.1 [P1, 依赖 2.1, 2.2, 3.1] 调整 `GitDiffPanel.test.tsx` 中以 `header?.lastElementChild` 断言 file count badge 的 case，改为按 `nextElementSibling` / `data-testid` 精准定位（或在 count badge 之前插入 line stats badge）；运行 affected Vitest suites 确认不回退。

## 5. Verification

- [x] 5.1 [P0, 依赖 1.1–4.1] 运行 affected Vitest suites、`npm run lint`、`npm run typecheck`、`npm run check:large-files`，输出通过结果或记录 pre-existing failures。
- [x] 5.2 [P0, 依赖 5.1] 运行 `openspec validate add-git-diff-section-line-count-badge --strict --no-interactive`；手动核对 git diff 确认未覆盖工作区未提交改动。
- [x] 5.3 [P1, 依赖 5.1] 手动验证 single-repo tree / flat、multi-repo 模式下，section / group header 渲染 `+n-m` 徽章；折叠时 badge 仍可见；n 与 m 均为 0 时不显示。
