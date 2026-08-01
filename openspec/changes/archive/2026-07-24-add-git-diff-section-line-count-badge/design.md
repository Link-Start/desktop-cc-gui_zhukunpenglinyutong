## Context

Git Diff 面板当前在 section header（single-repo staged / unstaged）和 per-repo header（multi-repo）只显示文件数 badge。用户希望在这两个位置增加总变更行数 `+n-m` 徽章，以便快速预览每个 section 的工作量。

两类 section 的渲染分别由以下组件负责：

- single-repo：`src/features/git/components/GitDiffPanelFileSections.tsx` 内的 `DiffTreeSection`（tree 视图）与 `DiffSection`（flat 视图）。它们都通过 `renderSectionCountBadge(files.length)` 渲染 file count badge。
- multi-repo：`src/features/git/components/GitMultiRepositoryChanges.tsx` 内的 `git-repository-change-group__header` 渲染 repository group header，含 `git-repository-change-group__count`（file count 文案）。

数据来源：

- `DiffFile`（=`GitFileStatus`）已携带 `additions` / `deletions` 字段；`DiffTreeSection` / `DiffSection` 通过 `files` prop 接收。
- `RepositoryGitStatus` 已携带 `totalAdditions` / `totalDeletions` 字段（来自 `useMultiRepositoryGitStatus` 的聚合）。

## Goals

- section header 新增 `+n-m` 锚点行变更徽章，n/m 为 section 聚合、新增；`files.length` badge 保留。
- 新徽章与既有 per-file `diff-counts-inline git-filetree-badge` 视觉一致（success / destructive 颜色、tabular-nums、圆角胶囊）。
- new badge 仅展示，不引入新的点击行为；section 整体的 hide/show 仍由 chevron / section indicator 控制。
- 当 n 与 m 均 0 时 badge 不渲染，避免视觉噪声。

## Non-Goals

- 不修改 IPC 或 backend payload。
- 不展开 hunk 粒度信息、不实现排序、不影响 commit selection。
- 不修改 i18n key 集（label 仍为 `+n-m` 数字形态）。

## Key Decisions

- **聚合位置**：在 `DiffTreeSection` / `DiffSection` 内部用 `useMemo` 聚合 `files`，不需要修改 `GitDiffPanel.tsx` 的 prop 形状。
- **徽章样式**：复用既有的 `diff-counts-inline git-filetree-badge` className + `is-add` / `is-sep` / `is-del` 子元素，让 CSS 共用同一套 token，避免新增重复样式。
- **hide/show 协同**：badge 放在 `diff-section-title`（tree）或 `diff-section-title`（flat）内，与 `renderSectionCountBadge` 平级；当 section 进入 `is-collapsed` 状态时 header 仍渲染，badge 自然可见。
- **multi-repo 布局**：把 `+n-m` 放在 `git-repository-change-group__count` 内（与 `filesChanged` 文案并排），避免打乱现有 5 列 grid。

## File-Level Changes

1. `src/features/git/components/GitDiffPanelFileSections.tsx`
   - 新增 `renderSectionLineStatsBadge(additions, deletions)` helper，返回 `+n-m` 徽章。
   - `DiffTreeSection`：`useMemo` 聚合 `files` 的 `additions` / `deletions` 之和；在 `renderSectionCountBadge(files.length)` 之前渲染 `renderSectionLineStatsBadge(...)`。
   - `DiffSection`：同上。
2. `src/features/git/components/GitMultiRepositoryChanges.tsx`
   - `git-repository-change-group__count` 内部：在 `t("git.filesChanged", ...)` 文案前渲染 `+n-m` 徽章（仅在 `totalAdditions` 或 `totalDeletions` 大于 0 时）。
3. `src/features/git/components/GitDiffPanelFileSections.tsx` 测试
   - 现有 `GitDiffPanel.test.tsx` 的 `header?.lastElementChild?.classList.contains("diff-section-count-badge")` 断言需要更新为倒数第二个元素（因为新的 line stats badge 在 count badge 之前）。或者：在断言中改为按 `data-testid` / `data-section` 精准定位。
   - 新增 1 个 focused test：验证 staged / unstaged section header 在 file count badge 之前渲染 `+n-m` 徽章，n/m 为文件之和。
4. `src/features/git/components/GitMultiRepositoryChanges.test.tsx`
   - 新增 1 个 focused test：验证 per-repo header 渲染 `+n-m` 徽章，数据来自 `status.totalAdditions` / `totalDeletions`；n 与 m 均为 0 时不渲染。

## Risks

- 受影响测试需要按新的 header 顺序更新 lastElementChild 断言。
- 若现有 payload 中 `additions` / `deletions` 缺失（fallback / image / binary），聚合结果可能为 0，徽章会被隐藏，符合 contract。
