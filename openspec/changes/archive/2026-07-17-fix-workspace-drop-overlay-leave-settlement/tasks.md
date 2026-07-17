## 1. Regression Contract

- [x] 1.1 [P0, 无依赖] 增加 Rust focused test，证明 forwarded leave payload 的 `type` 为 `leave` 且不携带 paths，并确认当前实现失败。

## 2. Root Fix

- [x] 2.1 [P0, 依赖 1.1] 在 `forward_webview_drag_drop_to_main` 共享 bridge 中转发 `DragDropEvent::Leave`，不增加 Sidebar timeout 或 DOM heuristic。
- [x] 2.2 [P1, 依赖 2.1] 更新 Desktop Drag-Drop contract，明确 leave terminal event 与无 position hit-test 语义。
- [x] 2.3 [P1, 依赖 2.1] 将 `usePasteAndDrop` leave settlement 前移到 position hit-test 之前，并增加 focused regression test。

## 3. Verification

- [x] 3.1 [P0, 依赖 2.1] 运行 Rust focused test、workspace drop hook focused Vitest、typecheck 与 lint。
- [x] 3.2 [P0, 依赖 2.2] 运行 `openspec validate fix-workspace-drop-overlay-leave-settlement --strict --no-interactive`。
- [ ] 3.3 [P1, 依赖 3.1] 在 rebuilt Tauri app 中手工复现“Sidebar 内进入、移出应用窗口、外部松开”，确认 overlay 消失。
