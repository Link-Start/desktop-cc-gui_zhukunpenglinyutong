## Why

当前 file tree 已能为多个 nested Git repositories 展示 branch 与 working-tree count，但 folder/file decoration 仍只消费单一 active Git root 的 `gitStatus.files`。这导致 multi-project workspace 中 sibling repositories 无法并行显示 changed file/folder 状态，同时 repository identity 使用蓝色 folder icon 与角标覆盖了原有文件夹视觉语义。

## 目标与边界

- 保留原有 file/folder icon，不再用 icon 颜色或角标表达 repository identity。
- 为所有已发现 repositories 并行投影 compact file status，使 file、ancestor folder 与 exact repository root 均能显示独立变更状态。
- 将 branch、clean、modified/untracked、conflicted/error 拆成 theme-aware semantic colors，兼容 light、dark 与 system theme。
- 使用 IDEA-inspired Git palette：dark/light 分别定义 added、modified、deleted、renamed、type-changed、conflict 与 branch colors；branch 固定为截图所示暖橙语义。
- changed file/folder name 在现有 `400` 基础上仅提升到 `550`，增强辨识但不改变未变更 row typography。
- exact dirty repository folder 不再继承内部最高优先级 status color；统一使用 theme-aware blue，内部 ordinary folder/file 继续按变更性质着色。
- branch token 保持暖橙语义并使用 `font-weight: 600`，与 count/sync token 建立清晰层级。
- 保持 aggregate read、partial failure、stale-result rejection 与 `>=30s` fallback，不引入 per-repository polling。

## 非目标

- 不改变 Git Diff、History、Commit、Push 等 write workflows。
- 不返回 diff content、additions/deletions 或 commit history。
- 不新增第三方依赖，不引入 filesystem watcher。
- 不改变 repository discovery depth、上限或显式 repository action target。

## 方案对比与取舍

### 方案 A：frontend 为每个 repository 并行调用 status command

实现直观，但会把 repository count 放大成 N 次 IPC/polling，并重复处理 partial failure 与 stale response；与现有 aggregate contract 冲突，拒绝。

### 方案 B：在现有 aggregate summary scan 中附带 compact decoration entries（采纳）

Rust 已为每个 repository 遍历 `git2::Statuses` 计算 counts，可在同一次遍历中收集最小 `path + status` projection。frontend 统一加上 `repositoryRoot` 前缀后合并为 workspace-level status map，避免重复扫描、额外 command 与 target race。

## What Changes

- 扩展 `GitRepositorySummary`，为每个 repository 返回 repository-relative compact file decorations。
- local desktop 与 remote daemon 保持 additive payload parity，并在 frontend normalization 中兼容字段缺失。
- file tree 合并所有 repository decorations，不再只依赖 active root 的 `gitStatus.files`。
- repository folders 恢复原有 folder icon；变更信息通过 folder name 与 trailing semantic tokens 表达。
- Git summary tokens 按 branch/clean/dirty/conflict/error 分配 theme-aware semantic color。
- Git file/folder 与 branch token 统一消费 theme-level `--git-status-*` / `--git-branch` tokens；changed name 使用 `font-weight: 550`。
- 增加 multi-repository isolation、path normalization、partial failure、folder ancestor projection 与 theme styling regression tests。

## Capabilities

### New Capabilities

- `multi-repository-file-tree-decorations`: 定义多 repository compact file-status 聚合、workspace path projection、folder/icon 语义与 theme-aware Git tokens。

### Modified Capabilities

<!-- 无：原 multi-repository capability 仍位于尚未归档的 completed change，本 follow-up 使用独立 capability 避免跨 change delta anchor 冲突。 -->

## 验收标准

- multi-repository workspace 中两个或更多 dirty repositories 同时显示各自 branch、count、changed file 与 ancestor folder color。
- repository folder 与普通 folder 继续使用原有 `getFileTreeIconSvg` 输出，不出现 repository 专属蓝色覆盖或角标。
- clean、modified/untracked、conflicted/error token 在 light、dark 与 system theme 下均使用 semantic variables，保持可读对比度。
- branch 在 dark/light theme 下分别使用暖橙 `#FFB37A` / `#C96B2C`，changed file/folder name 轻量加粗且 icon 不受影响。
- 两个 dirty sibling repositories 即使内部变更类型不同，其 exact repository folder name 也统一为 dark `#82AAFF` / light `#2563EB`；branch text 为 `600`。
- 一个 repository unavailable 时只降级自身 summary，其他 repository decorations 仍可见。
- aggregate response 仍为单次 IPC，不产生 per-repository polling loop。
- focused frontend/Rust tests、typecheck、lint、runtime contract、large-file gate 与 strict OpenSpec validation 通过。

## Impact

- Frontend：`src/types/git.ts`、`src/features/git/utils/gitRepositorySummary.ts`、`src/features/files/components/FileTreePanel.tsx`、`FileTreeRows.tsx`、`src/styles/file-tree.css` 与 focused tests。
- Bridge/backend：`src-tauri/src/types.rs`、`src-tauri/src/git_utils.rs`、daemon/shared serialization tests；payload 为 additive change。
- Runtime：aggregate summary payload 增加 compact `path + status` entries，但不包含 diff/stat content；无新增 dependency。
