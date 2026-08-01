# Git Blame 按需加载 changed-line markers

## Goal

关联 OpenSpec change：`fix-file-editor-git-marker-load-race`。默认 file open 不加载 Git full diff；用户启用 Git Blame 后再加载并显示 changed-line markers。

## Requirements

- ordinary file open 不调用 `getGitFileFullDiff`。
- Git Blame enabled 且 initial document read settled 后加载 markers。
- Blame/diff 独立并发与独立容错。
- toggle off、切 Tab、snapshot replacement 后不提交 stale markers。
- added/untracked file 的 marker 能力不依赖 Blame 成功。

## Acceptance Criteria

- [ ] 默认打开 changed file 无 full-diff request。
- [ ] 点击 Git Blame 后显示 canonical added/modified markers。
- [ ] 关闭 Git Blame 后 markers 清空。
- [ ] Blame/diff failure 隔离，file switch race 安全。
- [ ] focused tests、typecheck、lint、OpenSpec strict validation 通过。

## Technical Notes

复用 `useFileGitBlame`、`getGitFileFullDiff`、`parseLineMarkersFromDiff` 与 existing CodeMirror marker extension；不新增 dependency、backend command 或持久化设置。
