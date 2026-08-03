# Tasks: compact-diff-push-button

## 1. GitDiffPanel.tsx

- [x] 1.1 删除 `.push-section` 大按钮区块，保留 `pushError` 独立错误行
- [x] 1.2 新增 `gitStatusPushButton` 工具栏按钮（Upload icon + `commitsAhead` 角标，spinner/disabled 处理）
- [x] 1.3 将按钮注入 `.git-panel-actions`（刷新按钮旁）

## 2. 样式

- [x] 2.1 `src/styles/diff.css` 新增 `.git-status-push-button` 与 `.git-status-push-count` 样式

## 3. 验证

- [x] 3.1 `npm run typecheck`
- [x] 3.2 改动文件 ESLint 通过
- [ ] 3.3 手动确认：ahead>0 显示并触发 `onPush`；ahead=0 隐藏（需用户在应用内确认）
