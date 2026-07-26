# Tasks: redesign-git-commit-composer

## 1. GitDiffPanel.tsx

- [ ] 1.1 重构 `singleCommitComposer`：textarea 与右侧操作列横向布局
- [ ] 1.2 新增内联提交按钮（位于 AI 生成按钮下方），移除 `CommitButton` 调用
- [ ] 1.3 保留错误行、提示文案

## 2. 样式

- [ ] 2.1 `src/styles/diff.css` 新增 `.commit-message-actions`、`.commit-message-commit-button` 等样式
- [ ] 2.2 调整 `.git-commit-composer` 与 `.commit-message-input-wrapper` 以支持新布局

## 3. 验证

- [ ] 3.1 `npm run typecheck`
- [ ] 3.2 改动文件 ESLint 通过
- [ ] 3.3 GitDiffPanel 相关测试通过
