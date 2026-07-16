# 隐藏 Git History 左侧 Overview

## Goal

关联 OpenSpec change：`hide-git-history-overview-pane`。将 Git History 从四区域收敛为 `分支 / 提交 / 变更文件与提交详情` 三栏，并让三栏占满可用宽度。

## Requirements

- 从 visual layout 与 accessibility tree 隐藏最左侧 overview/worktree surface，同时保留顶部 summary 的 status source。
- 删除 overview 与 main grid 之间的专属 resize separator。
- 保留 branch、commit、details 三栏以及它们既有的 resize、selection、preview 行为。
- desktop 三栏在扣除两个 separator 后默认按 `3:4:3` 分配宽度。
- 清理仅服务于 overview resize 的 wiring，不新增 visibility toggle 或新抽象。
- 不修改 backend、Git service contract 或其他 active change 的文件。

## Acceptance Criteria

- [ ] `.git-history-overview` 不再可见且不进入 accessibility tree。
- [ ] branch、commit、details 三个 region 仍渲染并占满 panel。
- [ ] desktop 默认比例为 branch `30%`、commit `40%`、details `30%`。
- [ ] right details 的 changed files / commit message split 保持不变。
- [ ] focused test、typecheck、lint、large-file check、diff check 与 OpenSpec strict validation 通过。

## Technical Notes

- 复用现有 `.git-history-main-grid`，不创建平行 layout component。
- 目标 view/CSS 当前无既有未提交修改；如实施中发现 overlap，立即停下并重新评估。
