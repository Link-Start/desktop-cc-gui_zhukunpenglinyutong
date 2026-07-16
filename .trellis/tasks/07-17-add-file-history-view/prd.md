# 单文件历史列表视图

## Goal

实现第一版独立 File History view：用户从文件树 Git submenu 打开目标文件的 commit history，并查看选中 commit 对该文件的 read-only diff。

关联 OpenSpec change：`add-file-history-view`。

## Requirements

- 复用 `get_git_commit_history` / `GitHistoryResponse`，增加 backward-compatible optional `path` scope。
- path history follow rename，并保持 Desktop/remote daemon parity。
- 正确处理 root 与 nested repository 的 `repositoryRoot` / repository-relative path。
- 独立 commit list + selected diff view，不修改通用 `GitHistoryPanelImpl` 状态机。
- 文件和 commit 快速切换时丢弃 stale async response。
- FileTree callback optional；detached explorer 第一版不显示不可用入口。
- 不修改当前 dirty `GitDiffPanel` / `diff.css` 逻辑。

## Acceptance Criteria

- [ ] 文件树文件右键可以通过 `Git -> 显示历史记录` 打开 File History。
- [ ] 左侧只显示触及该文件的 commits，支持 rename-follow 与分页。
- [ ] 右侧只显示当前 commit 对目标文件的 diff。
- [ ] root/nested repository、empty/error/retry、rapid switch 行为通过 focused tests。
- [ ] 未传 path 的现有 Git History 行为不回退。
- [ ] Desktop local 与 remote daemon contract 一致。
- [ ] OpenSpec strict validation、focused tests、typecheck 与 runtime contract checks 通过或明确记录既有阻塞。

## Technical Notes

- OpenSpec artifacts：`openspec/changes/add-file-history-view/**`。
- 优先使用 Git native `log --follow` 获取 OID sequence，再复用 `git2` commit mapping。
- UI 复用 `GitDiffViewer` 与现有 virtual list dependency。
- 新增 feature-scoped CSS，避免触碰当前未提交的 shared diff CSS。
