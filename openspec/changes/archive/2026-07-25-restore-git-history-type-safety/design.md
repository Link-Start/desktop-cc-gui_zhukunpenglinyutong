## Context

Git History 以 `GitHistoryPanelImpl` 聚合 state，再把巨型 object 传给 `renderGitHistoryPanelView`、`renderGitHistoryPanelDialogs` 与 `useGitHistoryPanelInteractions`。三个 consumer 使用 `scope: any` 和超大 destructuring，导致 dead fields、implicit any 与错误 cleanup 长期被 `@ts-nocheck` 隐藏。

## Goals / Non-Goals

**Goals:**

- 让 scope root 成为唯一 source type。
- consumer 只声明实际读取的字段。
- 保持所有 runtime behavior 与 callback identity。

**Non-Goals:**

- 不改 UI 与 Git command payload。
- 不把全部 state 搬入 global store。

## Decisions

1. 用 source object inference 建立 `GitHistoryPanelScope`，consumer contract 基于它收窄。相比手写 150 字段 interface，可避免 interface 与实现再次漂移。
2. 先删除 consumer 未使用 destructuring，再修真实 implicit-any。相比给 unused fields 加 underscore，删除能直接降低 scope fan-out。
3. 每移除一个 `@ts-nocheck` 就运行 typecheck 与 focused tests，避免四文件同时失去定位能力。

## Risks / Trade-offs

- [Risk] inferred scope 出现循环类型 → 把稳定跨层字段拆为显式 leaf types。
- [Risk] 删除字段误伤 JSX → 以 TypeScript symbol usage 和 focused tests 双重验证。
- [Risk] 大 diff 难 review → 按 Interactions、Dialogs、View、Impl 四个 slice review。

## Migration Plan

1. 建立 scope contract。
2. 按 consumer 清理并摘除 nocheck。
3. 修复 root diagnostics。
4. 运行回归并保留单 commit rollback。

## Open Questions

无。494 个 diagnostics 作为固定 baseline。
