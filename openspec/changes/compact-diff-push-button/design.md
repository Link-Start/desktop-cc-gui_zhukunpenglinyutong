# Design: compact-diff-push-button

## Context

`GitDiffPanel.tsx` 在更改列表上方渲染 `.push-section` 大按钮（条件：`commitsAhead > 0 && !stagedFiles.length`）。目标是把入口收敛到头部工具栏，与 `gitStatusRefreshButton` 同构。

## Decisions

### D1: 新按钮作为 `gitStatusPushButton` 节点注入 `.git-panel-actions`

与 `gitStatusRefreshButton` 相同的构造方式：在 return 前构建 JSX 常量，插入 `GitModeSelectorMount` 之后、`showApplyWorktree` 之前的工具栏行内。

显示条件：`mode === "diff" && commitsAhead > 0 && Boolean(onPush)`。
注意：原大按钮要求 `!stagedFiles.length`，新入口放宽为只要有 ahead 提交即显示——有暂存文件时用户同样可能需要先推送已有提交，且 `onPush` 行为与暂存状态无关。

### D2: 删除 `.push-section`，保留 `pushError` 独立渲染

原区块内嵌 `pushError` 展示。删除按钮后，错误行在无暂存文件且无 composer 的场景会丢失，因此在原位置保留一个仅渲染 `pushError` 的极简错误行。

### D3: 样式复用刷新按钮的视觉语言

`.git-status-push-button` 对齐 `.git-status-refresh-button` 的尺寸（13px icon）、hover / focus-visible / spinner 行为；角标 `.git-status-push-count` 使用现有徽标配色变量。不删除 `.push-button / .push-section / .push-count` 旧 CSS——`GitHistoryPanelDialogs.tsx` 仍引用同名 class。

## Risks

- **暂存态下显示推送入口的行为差异**：原设计在有暂存文件时隐藏推送按钮。放宽后用户可在提交前推送，属于预期内的可用性提升，推送失败仍由 `pushError` 反馈。
- **无测试直接引用旧按钮**：已确认无 test 引用 `push-button` / `pushButton` i18n key，无回归风险。

## Verification

- `npm run typecheck`
- `npx eslint src/features/git/components/GitDiffPanel.tsx`
- 手动：ahead > 0 时 icon 出现并可点击；ahead = 0 时隐藏。
