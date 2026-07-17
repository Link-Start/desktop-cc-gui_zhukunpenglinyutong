## Why

外部文件或文件夹拖入 Sidebar 后，如果用户把指针移出应用窗口再松开，workspace drop overlay 可能永久停留。前端已经消费 `type: "leave"` 来清理 hover state，但 Tauri `on_webview_event` bridge 对 `DragDropEvent::Leave` 返回 `None`，导致依赖 forwarded bridge 的 macOS / child WebView 路径永远收不到终止事件。

## 目标与边界

- 保证 native drag session 离开 WebView/窗口时，统一 drag-drop service 能收到 `leave` 并清理所有 drop overlay。
- 修复限定在 Tauri drag-drop bridge、focused regression test 与对应 contract。
- 保留现有 Sidebar、Composer drop target hit-test、drop dedupe 与文件路径处理语义。

## What Changes

- 将 `DragDropEvent::Leave` 映射为可序列化的 forwarded payload：`type: "leave"`、无 paths；position 使用无业务含义的默认值，因为 leave consumer 不执行 hit-test。
- 将 `ChatInputBox/usePasteAndDrop` 的 leave settlement 前移到 geometry normalize/hit-test 之前，与其他 drag-drop consumers 保持一致。
- 增加 Rust regression test，锁定 leave payload contract。
- 补充 Desktop Drag-Drop contract 与 OpenSpec behavior delta。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `composer-drag-drop-file-reference`: 补充 native drag leave 必须结束 drag-hover feedback 的契约；同一 bridge 同时服务 Composer 与 Workspace Sidebar consumer。

## 验收标准

- Finder/Explorer/file manager 拖入 Sidebar，移出应用窗口后松开，overlay 立即消失。
- native/forwarded `drop`、Composer insertion、Sidebar project import 行为不变。
- Rust focused test、workspace hook test、typecheck、lint 与 OpenSpec strict validation 通过。
