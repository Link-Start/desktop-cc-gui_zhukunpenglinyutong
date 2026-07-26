# Proposal: redesign-git-commit-composer

## Why

GitDiffPanel 的提交消息框与提交按钮当前采用上下布局：AI 生成按钮位于输入框右上角，提交按钮位于输入框下方。这种布局纵向占用较多空间，且提交按钮远离 AI 辅助入口。将提交按钮上移到 AI 生成按钮下方、输入框右侧，可形成紧凑的右侧操作列，并让 AI 生成 → 提交的视觉动线更自然。

## 目标与边界

- 移除输入框下方的大号「提交」按钮。
- 在输入框右侧新增竖向操作列：AI 生成消息按钮在上，提交按钮在下。
- 保持现有提交行为不变（调用 `onCommit`，传入 `selectedPaths`）。
- 保留并适当美化错误行、提示文案、loading / disabled 状态。

## 非目标

- 不改提交命令逻辑、`onCommit` 签名、`CommitButton` 组件本身（仅不再在 `GitDiffPanel` 内部使用）。
- 不改多仓库模式的提交区域（`GitMultiRepositoryChanges`）。
- 不改 AI 生成菜单逻辑。

## 技术方案对比

| 选项 | 做法 | 取舍 |
| --- | --- | --- |
| A. 直接重构 `singleCommitComposer` JSX（选定） | 在 `GitDiffPanel.tsx` 内联一个专用提交按钮，右侧操作列容器包裹 AI 按钮和提交按钮 | 改动集中、不污染 `CommitButton` 通用组件、易于根据当前上下文定制 compact 样式 |
| B. 扩展 `CommitButton` 支持 `compact` 模式 | 增加 props 控制布局与尺寸 | 组件接口变复杂，且仍需要调整父级布局；当前 `CommitButton` 在其它地方使用，改动风险更高 |

选 A：最小化影响面，父级完全掌控新布局。

## What Changes

- `src/features/git/components/GitDiffPanel.tsx`：`singleCommitComposer` 改为 textarea + 右侧操作列布局；移除原 `CommitButton` 调用，新增内联提交按钮。
- `src/styles/diff.css`：新增/调整提交区容器、右侧操作列、小提交按钮样式，保持暗色主题一致性。

## Capabilities

- **New Capabilities**: 无
- **Modified Capabilities**: `git-panel-diff-view` — 提交区布局由上下结构改为右侧操作列。

## Impact

- 代码：`src/features/git/components/GitDiffPanel.tsx`、`src/styles/diff.css`
- 行为：提交入口位置与形态变化；提交执行逻辑不变。
- 无 API / 依赖 / 后端变更。

## 验收标准

- 提交按钮不再出现在输入框下方。
- 输入框右侧显示 AI 生成按钮，紧接其下方显示提交按钮。
- 提交按钮在无选中文件、无消息、loading 时正确 disabled 并显示对应 title。
- 点击提交按钮调用 `onCommit(selectedPaths)`。
- `npm run typecheck` 与改动文件 lint 通过；GitDiffPanel 相关测试通过。
