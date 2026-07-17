# Verification

## Summary

| 维度 | 结果 |
|---|---|
| 完整性 | 5/5 tasks；2 requirements / 5 scenarios 均有实现证据 |
| 正确性 | Diff menu action 已隐藏；multi-repository collapse 按 `workspaceId + repositoryRoot + section` 隔离 |
| 一致性 | 遵循 local presentation state 与 existing `DiffSection` contract；无 public API、backend、Tauri 或 persistence 变更 |

结论：无 CRITICAL、WARNING 或 SUGGESTION，准备 sync/archive。

## Evidence

- `src/features/git/components/GitDiffPanel.tsx`
  - Diff mode menu 不再渲染 `Switch Git repository` action。
  - Existing repository selector panel、scan/select/clear props 保持不变。
- `src/features/git/components/GitMultiRepositoryChanges.tsx`
  - `sectionCollapseKey(workspaceId, repositoryRoot, section)` 提供无 delimiter collision 的 composite identity。
  - Existing `DiffSection.isCollapsed/onToggleCollapsed` contract 被 staged/unstaged sections 复用。
- `src/features/git/components/GitDiffPanel.test.tsx`
  - 验证菜单 action 不可见，同时 root selector 入口仍可打开。
- `src/features/git/components/GitMultiRepositoryChanges.test.tsx`
  - 验证 section/repository/workspace 隔离、`aria-expanded`、file row 显隐。
  - 验证 collapse/expand 不触发 stage、unstage、discard、refresh、file-open，且 commit selection state 往返不变。

## Commands

```text
npm exec vitest run src/features/git/components/GitDiffPanel.test.tsx src/features/git/components/GitMultiRepositoryChanges.test.tsx
PASS: 2 files, 80 tests

npm run lint
PASS

npm run typecheck
PASS

npm run check:large-files
PASS (exit 0; reported entries are pre-existing repository baseline items and do not include touched files)

git diff --check
PASS

npm run test
BLOCKED at batch 19/206 by pre-existing
src/features/app/components/Sidebar.styles.test.ts
("keeps the active file tab indicator contract"). The failing test and
file-view-panel CSS are unchanged from HEAD; focused changed-surface tests pass.

openspec validate hide-diff-repository-switch-and-fix-multi-repo-collapse --strict --no-interactive
PASS

openspec validate --specs --strict --no-interactive
PASS: 396 specs
```
