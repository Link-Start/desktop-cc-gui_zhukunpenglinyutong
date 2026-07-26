# Design: redesign-git-commit-composer

## Context

`GitDiffPanel.tsx` 的 `singleCommitComposer` 当前结构：

```
┌──────────────────────────────┐
│ textarea              [AI 🔥] │
├──────────────────────────────┤
│ error lines                  │
├──────────────────────────────┤
│       [✓ 提交]               │
├──────────────────────────────┤
│ hint                         │
└──────────────────────────────┘
```

目标：

```
┌──────────────────────────┬───┐
│ textarea                 │ 🔥│
│                          │ ✓ │
├──────────────────────────┴───┤
│ error lines                    │
├────────────────────────────────┤
│ hint                           │
└────────────────────────────────┘
```

## Decisions

### D1: 在 `singleCommitComposer` 内联提交按钮

不再使用 `CommitButton` 组件，因为新按钮需要：
- 竖向小尺寸（与 `.commit-message-generate-button` 同宽）。
- 与 AI 按钮同一列，父级 flex 布局控制。

逻辑完全复用：`canCommit = commitMessage.trim().length > 0 && selectedCount > 0 && !commitLoading`；点击调用 `onCommit?.(selectedPaths)`。

### D2: textarea 与右侧按钮列等高

使用 flex row：`flex: 1` 的 textarea 容器 + `flex: 0 0 auto` 的 action 列。action 列内两个按钮等高并拉伸填满 textarea 高度，避免各自独立浮动。

### D3: 视觉美化

- 输入框与按钮列共享相同圆角与边框色，看起来像一体面板。
- AI 按钮与提交按钮之间 1px 分隔线，使用 `border-bottom` / `border-top`。
- 提交按钮默认态使用 primary 背景色，disabled 态降低 opacity；hover 加深。
- 错误行与提示文案仍位于下方，保持原有语义。

### D4: 多仓库模式同步

`GitMultiRepositoryChanges.tsx` 的 `commitComposer` 采用与 `GitDiffPanel.tsx` 相同的右侧操作列布局，不再单独保留底部提交按钮，确保单仓/多仓视觉一致。

### D5: 保留 `CommitButton` 组件

其它地方（如 `GitHistoryPanelDialogs`）仍可能使用，不做删除或修改。

## Affected Files

- `src/features/git/components/GitDiffPanel.tsx`
- `src/features/git/components/GitMultiRepositoryChanges.tsx`
- `src/styles/diff.css`

- `npm run typecheck`
- `npx eslint src/features/git/components/GitDiffPanel.tsx src/styles/diff.css`（CSS 通过 stylelint 若项目已配置则额外跑）
- `npx vitest run src/features/git/components/GitDiffPanel.test.tsx src/features/git/components/GitDiffPanel.part2.test.tsx src/features/git/components/GitMultiRepositoryChanges.test.tsx`
