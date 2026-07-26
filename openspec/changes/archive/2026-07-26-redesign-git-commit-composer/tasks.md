# Tasks: redesign-git-commit-composer

## 1. GitDiffPanel.tsx

- [x] 1.1 重构 `singleCommitComposer`：textarea 与右侧操作列横向布局（使用 `.commit-message-composer-row`）
- [x] 1.2 新增内联提交按钮（位于 AI 生成按钮下方），移除 `CommitButton` 调用
- [x] 1.3 保留错误行、提示文案

## 2. GitMultiRepositoryChanges.tsx

- [x] 2.1 多仓模式同步改为右侧操作列布局（使用 `.commit-message-composer-row`）

## 3. 样式

- [x] 3.1 `src/styles/diff.css` 新增 `.commit-message-composer-row`、`.commit-message-actions`、`.commit-message-commit-button` 等样式
- [x] 3.2 保留 `.commit-message-input-wrapper` 与 `.commit-message-generate-button` 通用样式，避免破坏 CheckpointCommitDialog 与 GitHistoryWorktreePanel

## 4. 验证

- [x] 4.1 `npm run typecheck`
- [x] 4.2 改动文件 ESLint 通过
- [x] 4.3 GitDiffPanel / GitMultiRepositoryChanges / GitHistoryWorktreePanel 相关测试通过
