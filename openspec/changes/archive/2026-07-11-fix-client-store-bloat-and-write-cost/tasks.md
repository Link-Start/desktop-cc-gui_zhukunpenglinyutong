# Tasks

## 1. Rust client store 写路径降本

- [x] 1.1 `client_storage.rs`：新增进程内 store cache（`Mutex<HashMap<PathBuf, Value>>`），`client_store_read` 首读落盘后写入 cache，后续 patch/write 不再重复 read+parse
- [x] 1.2 `patch_store_at_path`：改为仅对 patch 涉及的 key 做 equality 比较；命中 no-op 时跳过写盘
- [x] 1.3 序列化改为 `serde_json::to_string`（compact），保留原子写（tmp + fsync + rename）
- [x] 1.4 `cargo test` 覆盖：noop patch 不写盘、cache 与磁盘一致、compact 输出可回读

## 2. kanban 图片落盘

- [x] 2.1 Rust 新增 `client_save_kanban_image(data_url) -> String`：解析 `data:image/<ext>;base64,`，写入 `client/kanban-images/<uuid>.<ext>`，返回绝对路径；注册进 `command_registry.rs`
- [x] 2.2 前端 `services/tauri` 暴露 `saveKanbanImage(dataUrl)`
- [x] 2.3 `TaskCreateModal.handleAttachImages`：data URL 即时落盘，store 内只保留路径
- [x] 2.4 `useKanbanStore`：加载后检测存量 data URL，异步迁移并保存
- [x] 2.5 渲染路径回归：`RichTextInputAttachments` 已支持本地路径（`convertFileSrc`），无需改动，验证即可

## 3. startup maintenance（存量止血）

- [x] 3.1 新增 `src/services/clientStoreMaintenance.ts`：
  - `diagnostics.threadSessionLog` 存量按 label 黑名单过滤 + 单条 payload 截断 + 条数上限
  - legacy `app` store 的 `diagnostics.threadSessionLog` / `diagnostics.rendererLifecycleLog` 迁移后置空
  - `threads.customNames` 超容量裁剪（保留最近 2,000 条）
- [x] 3.2 `bootstrapApp.tsx` 在 `preloadClientStores` 完成后调用
- [x] 3.3 单元测试覆盖过滤 / 截断 / 裁剪 / 置空

## 4. 新增条目体积上限

- [x] 4.1 `useDebugLog.normalizeThreadSessionLogPayload`：对象 payload 序列化超限时截断为 preview 字符串
- [x] 4.2 单元测试

## 5. 写入源节流

- [x] 5.1 `liveAssistantShadowTranscript.ts`：模块级内存 store + 约 1s 节流 flush；settle 立即 flush
- [x] 5.2 `threadStorage.saveCustomName`：超容量按插入序淘汰最旧条目
- [x] 5.3 单元测试

## 6. 验证

- [x] 6.1 `npm run typecheck`（或等价 tsc）通过
- [x] 6.2 相关 vitest 通过（useDebugLog / rendererDiagnostics / kanbanStorage / liveAssistantShadowTranscript / clientStoreMaintenance / kanban 组件全量 / useThreadEventHandlers，共 182 个用例）
- [x] 6.3 `cargo test`（client_storage，6 个用例）通过
