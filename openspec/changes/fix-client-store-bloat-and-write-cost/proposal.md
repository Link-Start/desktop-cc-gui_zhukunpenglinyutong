# fix-client-store-bloat-and-write-cost

## 背景

上一轮 `fix-diagnostics-idle-cpu-storm` 只挡住了部分新增诊断条目，但用户在启动后与每次提问时 CPU 仍会飙升。现场排查确认根因是两层叠加：

1. **client store 文件病态膨胀**（`~/.ccgui/client/`）：
   - `app.json` 约 24MB，其中 `kanban` key 约 21.65MB（`tasks[].images` 内嵌 base64 PNG 截图，单张最大约 1.2MB），另有 legacy `diagnostics.threadSessionLog` 死数据约 1.16MB。
   - `diagnostics.json` 约 8.2MB，`diagnostics.threadSessionLog` 存量约 5.7MB（含 `thread/list response` 约 5.1MB、`codex-no-progress-watchdog-scheduled` 约 0.5MB —— 即上一轮已停止新增但未清理的存量）。
   - `threads.json` 约 2.7MB，`customNames` 约 2.8MB / 约 21,000 条（只增不减）。
2. **`client_store_patch` / `client_store_write` 写路径机制昂贵**（`src-tauri/src/client_storage.rs`）：每次写入都对整份 store 做 full read → parse → clone → 全量 deep equality → pretty-print serialize → fsync → rename。文件越大，每次小 patch 的代价越高；kanban 拖拽、thread 标题、diagnostics、Claude streaming shadow transcript 等写入源叠加后形成 CPU storm。

## 目标

- **存量止血**：一次性 startup maintenance 清掉 `threadSessionLog` 超限存量与 legacy `app` store 死数据；`customNames` 裁剪到容量上限。
- **kanban 图片出库**：`data:image/...;base64` 图片落盘为 `~/.ccgui/client/kanban-images/` 下的文件，store 内只保留文件路径；存量数据在加载时迁移。
- **写路径降本**（Rust `client_storage.rs`）：
  - store 内容进程内缓存，避免每次 patch 重复 read+parse 整份文件；
  - patch 时只对 patch 涉及的 key 做 equality 比较，不再全量 deep compare；
  - 序列化改为 compact JSON（去掉 pretty-print 的体积与 CPU 开销）。
- **写入源节流**：`liveAssistantShadowTranscript` 的 per-delta 写入改为内存聚合 + 节流落盘（约 1s），settle 时立即落盘。
- **新增条目体积上限**：`threadSessionLog` 单条 payload 超限时截断，防止再次膨胀。

## 非目标

- 不改 store 文件格式（仍为 per-store JSON 文件 + 原子写），不引入 JSONL/SQLite。
- 不调整诊断面板 UI 与「复制卡顿现场」能力。
- 不改变 kanban 任务执行时 images 的下发语义（引擎侧本就支持本地文件路径）。

## 方案摘要

| 层 | 改动 | 文件 |
| --- | --- | --- |
| Rust store 机制 | in-memory cache（keyed by path）+ per-patch-key compare + compact JSON serialize | `src-tauri/src/client_storage.rs` |
| Rust 新命令 | `client_save_kanban_image(data_url) -> path`，base64 解码后落盘 `client/kanban-images/` | `src-tauri/src/client_storage.rs`、`command_registry.rs` |
| startup maintenance | `runClientStoreMaintenance()`：threadSessionLog 存量过滤 + 截断 + 上限；legacy `app` store `diagnostics.*` 置空；customNames 裁剪 | 新增 `src/services/clientStoreMaintenance.ts`，`bootstrapApp.tsx` 挂载 |
| kanban 图片 | attach 时 data URL 即时落盘为文件路径；load 时对存量 data URL 做异步迁移 | `TaskCreateModal.tsx`、`useKanbanStore.ts`、`kanbanStorage.ts`、`services/tauri` |
| 新增条目上限 | `normalizePayload` 增加序列化体积上限（超限截断为 preview） | `useDebugLog.ts` |
| shadow transcript | 模块级内存 store + 约 1s 节流 flush，settle 立即 flush | `liveAssistantShadowTranscript.ts` |
| customNames | 写入时超容量按插入序淘汰最旧条目 | `threadStorage.ts` |

## 风险与回滚

- **Rust in-memory cache 与多进程一致性**：现有 renderer 侧本就整份缓存 store 并盲写 patch，单实例假设已成立；写入时仍持有 file lock，行为不劣化。回滚即恢复每次 read+parse。
- **compact JSON**：仅影响可读性，不影响解析；文件体积显著下降。
- **kanban 图片迁移**：迁移为 best-effort，失败保留原 data URL，不丢数据；迁移后原 base64 从 store 中移除。
- **customNames 裁剪**：按插入序 FIFO 淘汰，最旧线程的自定义标题丢失属可接受损失（上限取 2,000 条）。
