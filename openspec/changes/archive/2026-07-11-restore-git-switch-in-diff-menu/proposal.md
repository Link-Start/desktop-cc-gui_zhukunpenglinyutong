# Proposal: 将 Git 仓库切换入口放入 Diff 菜单

## Why

Git Diff 面板已经支持在一个 workspace folder 下扫描并选择多个独立 Git repository，
但原来的 `路径 + 切换` 行被隐藏后，用户无法从当前面板发现入口。

把入口放进 `差异Diff` mode menu，可以保留当前提交区域的简洁布局，同时让“切换当前
Diff 使用的 Git repository”跟其他 Diff view controls 放在同一个菜单里。

## What Changes

- `GitDiffPanel` 的 `差异Diff` 下拉菜单新增 `Switch Git repository` action。
- 该 action 复用现有 `git-root-panel`、`onScanGitRoots`、`onSelectGitRoot`
  逻辑，不新增 backend command 或 service payload。
- 保持原来的 inline root row 隐藏策略，避免提交框上方重新出现单独一行入口。
- Git changes section header 采用 Source Control 风格：左侧 title 可真正折叠/展开 section，
  右侧 count badge 固定在最右侧，header 不再显示 repository/root project name。

## Impact

- Affected spec: `git-panel-diff-view`
- Affected code:
  - `src/features/git/components/GitDiffPanel.tsx`
  - `src/features/git/components/GitDiffPanel.test.tsx`
  - `src/i18n/locales/en.part5.ts`
  - `src/i18n/locales/zh.part5.ts`
  - `src/styles/diff.css`
