## Why

Git Diff 面板在 single-repo 与 multi-repo 模式下，section header（staged / unstaged 或 per-repo group）只显示文件数 badge。开发者无法在不点击展开文件列表的情况下，预估这一 section 的工作量小（多少行新增、多少行删除）。在改动规模较大时，行数是比文件数更直接的取舍依据。

## What Changes

- Git Diff 面板的 staged / unstaged section header 在 file count badge 旁新增 `+n-m` 行变更总览徽章；n 为 section 内所有文件 additions 之和，m 为 deletions 之和。
- Multi-repository 模式下，每个 repository group header 在 `N 个文件已更改` 旁新增 `+n-m` 行变更总览徽章；n/m 来自 `RepositoryGitStatus.totalAdditions` / `totalDeletions`。
- 行变更徽章沿用既有的 additions / deletions 颜色（add 用 success、del 用 destructive），使用与 per-file `diff-counts-inline git-filetree-badge` 相同的视觉 token。
- 新徽章仅作为视觉信息，不引入新的点击语义；section 整体的 hide/show 仍由既有的 chevron / section indicator 控制，新徽章跟随其状态（位于 header，未被折叠）。
- 不修改 IPC、backend、git status payload；不引入新依赖；不修改 i18n key 集（label 仍为 `+n-m` 数字形态）。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `git-panel-diff-view`: Git Diff section header 在 file count badge 旁新增 `+n-m` 行变更总览徽章。
- `multi-repository-git-commit-workspace`: Multi-repository per-repo group header 在 `filesChanged` 文案旁新增 `+n-m` 行变更总览徽章。

## Impact

- Affected code:
  - `src/features/git/components/GitDiffPanelFileSections.tsx`（DiffTreeSection / DiffSection header）
  - `src/features/git/components/GitDiffPanel.tsx`（section-scoped totals 聚合）
  - `src/features/git/components/GitMultiRepositoryChanges.tsx`（per-repo header）
  - `src/styles/diff.css`（若需要新增微调样式 token）
  - 相关 Vitest suites
- APIs: 无新增或破坏性 API；复用现有 `DiffFile.additions` / `.deletions` 与 `RepositoryGitStatus.totalAdditions` / `totalDeletions`。
- Dependencies: 无新增依赖。
- Compatibility: additions / deletions 缺失或为 0 的旧 payload 仍能正常渲染（徽章收缩为 `+0 -0` 或隐藏）。

## 目标与边界

- 目标：让用户在不展开文件列表的情况下，看到当前 section 的总行变更（preview 性质，不是 commit-level diff）。
- 边界：仅展示 additions / deletions 之和；不展示 hunk 粒度、不展开 per-file 详情、不影响 commit selection / stage / unstage / discard 状态。

## 非目标

- 不引入独立的 `+n-m` sortable column 或任何排序能力。
- 不修改 IPC payload，不调整 `getGitStatus` schema。
- 不暴露 `totalAdditions` / `totalDeletions` 的额外 metadata。
- 不替换既有 file count badge；只是并排新增。

## 方案取舍

1. 选择：复用既有的 per-file `+n-m` 视觉样式 token，新增 section-level 聚合徽章。改动小，视觉一致，复用既有 `additions` / `deletions` 字段。
2. 不选择：新增 backend field 携带 `sectionLineStats`。现有 `DiffFile` 已提供 `additions` / `deletions`，前端聚合即可，无须扩大 IPC 契约。

## 验收标准

- 单 repo 模式下，staged / unstaged section header 在 file count badge 旁显示 `+n-m`，n/m 为该 section 内所有文件 additions / deletions 之和。
- 多 repo 模式下，每个 repository group header 显示 `+n-m`，n/m 来自 `status.totalAdditions` / `totalDeletions`。
- 当 section / group 被折叠时，徽章保留在 header，仍可见。
- 当 n 与 m 均为 0 时，徽章不显示（避免视觉噪声）。
- 既有 file count badge 的 layout、test 与 accessibility contract 不回退。
- focused Vitest suites、`npm run lint`、`npm run typecheck`、large-file sentry 与 `openspec validate --strict --no-interactive` 通过。
