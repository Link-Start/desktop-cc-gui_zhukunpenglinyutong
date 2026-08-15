# client-storage-performance delta — remove-kanban-and-task-center

## REMOVED Requirements

### Requirement: kanban 任务图片以文件形式存储
**Reason**: Kanban 任务弹窗与 `client_save_kanban_image` Tauri 命令已删除；不再有新的 kanban 图片写入路径。
**Migration**: 存量 `~/.ccgui/client/kanban-images/` 与 app.json kanban image 路径保留不动，不做迁移或清理。client store patch / 启动维护 / 高频写入节流条款不受影响。
