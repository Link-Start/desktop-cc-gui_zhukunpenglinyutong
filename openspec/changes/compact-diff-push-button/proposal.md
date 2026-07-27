# Proposal: compact-diff-push-button

## Why

GitDiffPanel 的「推送 N」目前是一个占据整行宽度的大按钮（`.push-section`），在更改列表上方抢占大量纵向空间，且只在「有 ahead 提交且无暂存文件」时才出现，视觉权重与其实际使用频率不匹配。需要把它收敛为顶部工具栏的小型 icon + 数量角标，与刷新按钮同级。

## 目标与边界

- 移除 Diff 面板更改列表上方的大号推送按钮区块（`.push-section`）。
- 在 Diff 面板头部工具栏（模式选择器 / 刷新按钮所在行）新增紧凑推送入口：Upload icon + ahead 数量角标。
- 仅当存在可推送提交（`commitsAhead > 0`）且面板处于 diff 模式时显示；否则完全隐藏。
- 保留推送失败的错误展示（`pushError`），不因移除按钮区块而吞掉错误。

## 非目标

- 不改动 GitHistoryPanel 工具栏的推送 chip（带推送对话框的完整流程）。
- 不改动多仓库模式（`GitMultiRepositoryChanges`）的任何推送交互。
- 不改动推送执行逻辑、`onPush` 回调签名或后端 push 命令。
- 不新增 i18n key（复用现有 `git.pushButton` / `git.pushCommits`）。

## 技术方案对比

| 选项 | 做法 | 取舍 |
| --- | --- | --- |
| A. 工具栏 icon + 角标（选定） | 在 `.git-panel-actions` 内刷新按钮旁渲染小按钮，复用现有 `commitsAhead` / `onPush` / `pushLoading` props | 与刷新按钮视觉同级，空间占用最小；显示条件与原按钮语义一致，改动面最小 |
| B. 保留区块但缩小样式 | 仅改 CSS 把 `.push-section` 压缩成单行小条 | 仍占据内容区一行，未解决视觉权重问题；且「何时出现」的条件割裂感保留 |

选 A：用户明确要求入口上移到菜单栏，且 A 的代码路径与现有 `gitStatusRefreshButton` 完全同构，风险最低。

## What Changes

- `GitDiffPanel.tsx`：删除 `.push-section` 大按钮区块；新增 `gitStatusPushButton` 工具栏按钮（icon + 角标，`commitsAhead === 0` 时隐藏）；`pushError` 错误行保留在原位置独立渲染。
- `src/styles/diff.css`：新增 `.git-status-push-button` 及角标样式，对齐 `.git-status-refresh-button` 的尺寸与交互态。

## Capabilities

- **New Capabilities**: 无
- **Modified Capabilities**: `git-panel-diff-view` — 推送入口从内容区大按钮改为头部工具栏紧凑入口，并定义显示/隐藏条件。

## Impact

- 代码：`src/features/git/components/GitDiffPanel.tsx`、`src/styles/diff.css`
- 行为：Diff 面板推送入口位置与形态变化；推送触发行为不变（仍调用 `onPush`）。
- 无 API / 依赖 / 后端变更。

## 验收标准

- `commitsAhead > 0` 且 diff 模式时，头部工具栏刷新按钮旁出现推送 icon + 数量角标；点击触发 `onPush`。
- `commitsAhead === 0`、非 diff 模式时，推送入口完全不存在于 DOM。
- 原 `.push-section` 大按钮不再渲染。
- 推送失败时 `pushError` 仍可见。
- `npm run typecheck` 通过；改动文件 lint 通过。
