# 多仓库 Git 提交工作区

关联 OpenSpec change：`add-multi-repository-git-commit-workspace`。

## 目标

- single repository 保持既有 compact file shape，但与 multi repository 统一将 commit composer 吸附在底部。
- multi repository 同时显示 dirty repository groups。
- 所有 Git mutation 以 `workspaceId + repositoryRoot` 定位。
- 多仓库按 repository 独立提交，partial failure 可见且可重试。
- Git History 保留 existing workspace/worktree 根选择器，并在 multi repository workspace 中增加第二层 repository picker；切换 child repository 不改变主 active workspace。
- single/multi commit composer 使用一致的 AI engine icon/menu；multi generation 按 `repositoryRoot + selectedPaths` 聚合 scoped diffs。

## 验收

以 OpenSpec `tasks.md` 与 delta specs 为准。
