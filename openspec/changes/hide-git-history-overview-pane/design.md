## Context

`GitHistoryPanelView` 当前由 outer `.git-history-grid` 承载 overview 与 inner `.git-history-main-grid`，desktop 模式还在二者之间渲染独立 resizer。用户需要的三栏已经完整存在于 inner grid，因此无需创建新 layout component。边界追踪同时确认 `GitHistoryWorktreePanel` 通过 `onSummaryChange` 维护顶部 changed-file/line summary；完全卸载会造成统计回归。

当前工作区存在大量其他未提交变更，但目标 view 与 Git History layout stylesheet 没有既有修改。本变更必须保持微创，禁止顺带整理 Git service、worktree commit semantics 或其他 active OpenSpec change。

## Goals / Non-Goals

**Goals:**

- visible layout 与 accessibility tree 只暴露 branch、commit、details 三个主区域。
- 三栏直接占满可用空间，desktop column resizing 仍作用于这三栏。
- 移除 overview resize path，同时保留维持顶部 summary 所需的 mounted status source。
- 用 component regression test 固化“三栏存在、overview 不存在”的结构契约。

**Non-Goals:**

- 不提供 overview visibility preference 或 runtime toggle。
- 不迁移 `GitHistoryWorktreePanel` 能力。
- 不改变 repository、branch、commit、diff 的 fetch/mutation contract。
- 不调整三栏内部密度、copy、toolbar 或详情上下 split。

## Decisions

### 1. Promote the existing main grid instead of inventing a new layout

保留 `.git-history-main-grid` 作为三栏 canonical container，并把 outer grid 固定为单列。相比新增 `git-history-three-column-grid`，复用现有 selector 能保留三栏 width/resizer contract，减少 CSS 与 test 迁移。

### 2. Hide overview presentation but preserve its summary data source

overview container 使用原生 `hidden` 与 `aria-hidden` 退出 visual/accessibility tree，且不再渲染相邻 separator；`GitHistoryWorktreePanel` 继续挂载并通过既有 callback 更新顶部 summary。相比卸载后抽取新 headless hook，这个方案避免复制 Git status fetch/refresh contract，也不会让顶部统计退化。

### 3. Preserve surviving column resize behavior

branch/commit/details 的 `mainGridRef`、`mainGridStyle` 与内部 separators 保持不变；只移除 overview-to-main separator。这样本变更不重定义现有三栏宽度 persistence，也不扩大到 resize hook architecture。

### 4. Test the rendered contract, not implementation details

在现有 `GitHistoryPanel.test.tsx` 中断言 overview/worktree surface 缺席，并断言 branch、commit、details regions 仍存在。CSS 仅做必要 selector 收敛，不新增 snapshot 或脆弱 pixel assertions。

### 5. Default the surviving columns to 3:4:3

`getDefaultColumnWidths(containerWidth)` 只对 visible branch/commit/details columns 分配宽度：先扣除两个 `VERTICAL_SPLITTER_SIZE`，再按 `30% / 40% / 30%` 计算并执行既有 minimum-width guard。desktop mount 已通过 existing effect 重新应用 defaults，因此无需新增 persistence schema version；selected branch、commit、query 与 diff style 不受影响。

## Risks / Trade-offs

- [Risk] hidden component 仍执行 status fetch → 这是维持顶部 summary 的 intentional data-source ceiling；若未来移除顶部 summary，可整体删除该 source；若未来需要纯 headless contract，再抽取现有 status hook。
- [Risk] outer grid 删除后 flex sizing 失效 → 将 `width/flex/min-height/overflow` contract 收敛到 surviving main grid，并通过 layout test 与人工 DOM inspection 验证。
- [Risk] 用户失去 Git History 内的 worktree commit surface → 这是本次明确产品取舍；主 Git panel 保持 canonical commit surface，本变更不做隐式迁移。
- [Risk] 误改其他 active Git History 工作 → 仅修改 clean target files，对每个 diff hunk 做 scoped review。

## Migration Plan

1. 隐藏 overview presentation 并删除专属 separator。
2. 清理失效的 overview resize wiring，保留 summary callback。
3. 收敛 grid CSS，让三栏占满 panel。
4. 更新 focused regression tests 并执行 static/spec gates。

回滚时反向恢复本 change 的 view、CSS、test 与 artifacts；不需要 data migration 或 backend rollback。

## Open Questions

无。用户已明确要求直接隐藏并固定为三栏，不需要 visibility preference。
