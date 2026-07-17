## Context

`src/services/dragDrop.ts` 聚合 main window native listener 与 Rust forwarded bridge。`useWorkspaceDropZone` 对 `leave` 和任意位置的 `drop` 都会先清理 `isDragOver`。当前断点位于 Rust bridge：`Enter`、`Over`、`Drop` 会 emit，`Leave` 被丢弃。由于外部拖拽离开窗口后不会产生 DOM `drop`，前端无后续事件可用于收敛 overlay state。

## Decision

在共享 Rust bridge 的事件映射处修复一次：forward `DragDropEvent::Leave`，而不是在 Sidebar 添加 timeout、window blur 或 pointer heuristic。

`Leave` 没有 native position，但 frontend payload contract 当前要求 position。bridge 将发送 `{ x: 0, y: 0 }`；所有 leave consumer 必须只将其视为 lifecycle terminal event，不做 target hit-test。

## Alternatives

- Sidebar timeout：会在用户仍停留于 target 时误关 overlay，且 Composer 等其他 consumer 仍会缺失 terminal event，拒绝。
- DOM `dragleave` / `dragend` 兜底：native Tauri file drag 不保证进入 DOM lifecycle，正是现有修复未覆盖真实场景的原因，拒绝。
- 修改 payload position 为 optional：会扩大 frontend contract 和所有 consumer 类型变更，本次不需要，拒绝。

## Verification

1. 先增加 leave payload regression test 并确认在当前实现上失败。
2. 最小修改 Rust mapping 使 test 通过。
3. 运行 workspace drop hook focused tests、Rust focused test、typecheck、lint 和 OpenSpec validation。
4. 手工验收仍需 rebuilt Tauri app：拖入 Sidebar 后移出整个应用窗口再松开。
