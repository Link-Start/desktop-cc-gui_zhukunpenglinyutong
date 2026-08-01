## Context

`projectContinuationFamilyRows()` 已将 eligible Family 成员连续投影，并把 `familyId`、成员数与 segment position 附加到每个 row。`ThreadList` 当前直接渲染所有 projected rows，标题只是 `pointer-events: none` 的绝对定位 label，因此成员多时会持续占用 Sidebar 高度。

约束是保持 Family 算法、row interaction、virtualization 与 backend metadata 完全不变，只在 presentation 层控制哪些 projected rows 可见。

## Goals / Non-Goals

**Goals:**

- Family 在每个 `ThreadList` 实例中默认折叠。
- 折叠态保留排序最前的代表 row、完整成员数和可访问的 disclosure control。
- 展开后恢复全部既有 rows 与 segment visual。
- pinned/unpinned list 行为一致。

**Non-Goals:**

- 不修改 `projectContinuationFamilyRows()` 的 grouping/sort contract。
- 不持久化 Family 展开状态。
- 不修改 catalog、IPC、backend 或 Session identity。

## Decisions

### 1. 在 ThreadList presentation boundary 过滤 projected rows

先按既有逻辑完成 `projectContinuationFamilyRows()`，再根据 local
`expandedContinuationFamilyIds` 过滤：

```text
ordinary row                         -> visible
expanded Family row                  -> visible
collapsed Family start segment       -> visible
collapsed Family middle/end segment  -> hidden
```

这样 member count 与排序仍来自同一 projection，不复制 Family 算法。替代方案是在 projection utility 中增加 UI state 参数；不采用，因为 pure catalog projection 不应依赖 React interaction state。

### 2. 保留首个代表 Session，而不是只显示空 header

首个 segment 是当前列表排序最前的 Family member，折叠后仍保留其完整 row interaction。相比空 header，这可以直接进入最新/最优先 Session，也避免 active representative 消失。

### 3. 标题升级为 local disclosure button

标题 button 使用既有 localized group label，添加 `aria-expanded` 与方向 icon。点击只更新当前 `ThreadList` 的 `Set<familyId>`，并阻止事件冒泡到 Session row。状态不写入 `clientStorage`，重新挂载自然回到默认折叠。

### 4. Collapsed chrome 由 CSS 收口

collapsed start segment 同时承担 start/end boundary，补齐 bottom border、bottom radius 和 padding。expanded 继续使用现有多 segment 样式。

## Risks / Trade-offs

- [Risk] 当前 active member 不是 Family 首个 row 时会在默认折叠态不可见 → 标题保留明确 count/disclosure，点击一次即可展开；不改变既有排序来避免语义漂移。
- [Risk] virtualizer 高度缓存与成员显隐不同步 → visible rows 数组变化会重建 virtual items，继续使用既有 stable key。
- [Trade-off] 展开状态不跨重启记忆 → 符合“默认折叠”的明确目标，并避免新增 preference lifecycle。

## Migration Plan

1. 增加 local expanded Family state 与 presentation filter。
2. 将 label 改为 disclosure button并补 collapsed CSS。
3. 更新 ThreadList/PinnedThreadList focused tests。
4. 同步 Trellis contract，执行 Vitest、typecheck、lint 与 OpenSpec strict validation。

回滚只需恢复 presentation filter、button 和 collapsed CSS；无数据迁移。

## Open Questions

无。用户已明确要求默认折叠且限定 UI-only。
