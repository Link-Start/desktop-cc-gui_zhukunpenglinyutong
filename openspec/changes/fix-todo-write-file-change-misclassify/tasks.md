## 1. 分类源头

- [x] 1.1 `resolve_tool_item_kind` 在 `contains("write")` 前排除 `todowrite` compact name
  - 输入：`src-tauri/src/engine/events.rs`
  - 输出：`TodoWrite` / `todo_write` / `mcp__x__TodoWrite` → `MpcToolCall`；`write` / `write_file` 仍 `FileChange`
  - 验证：新增 cargo test：`todo_write` / `TodoWrite` 的 `ToolStarted` item.type ≠ `fileChange`，且 `arguments.todos` 仍在
  - 依赖：无；优先级 P0

- [x] 1.2 审批 method 同步排除 checklist
  - 输入：同文件 `ApprovalRequest` 分支
  - 输出：`todo_write` 不得映射 `item/fileChange/requestApproval`
  - 验证：cargo test 钉 method
  - 依赖：1.1；优先级 P0

- [x] 1.3 Shared `is_edit_like_tool_name` 排除 `todowrite`
  - 输入：`src-tauri/src/shared_projection/projector.rs`
  - 输出：Shared Claude TodoWrite 保持原 tool name，不当 edit
  - 验证：既有 projector 测试不回归；必要时补一条 name 用例
  - 依赖：无；优先级 P1

## 2. 前端防守与任务条

- [x] 2.1 `buildConversationItem` 若仍收到 `fileChange` + todo 名，回退 generic 并保留 JSON detail
  - 输入：`src/utils/threadItems.ts`
  - 输出：title/tool 为 `todo_write` / `TodoWrite` 时 `detail` 可 `JSON.parse` 出 `todos`
  - 验证：`threadItems.test.ts` 补一条
  - 依赖：1.1；优先级 P1

- [x] 2.2 任务条回归：连续两次 todo_write 取后者
  - 输入：`useStatusPanelData.test.ts` 或 realtime adapter test
  - 输出：第二份 `{ todos }` 替换第一份
  - 验证：focused vitest 绿
  - 依赖：1.1、2.1；优先级 P0

## 3. 回归与索引

- [x] 3.1 focused cargo test `events` + Shared projector；vitest threadItems / status-panel
  - 验证：全绿；真 write/edit 用例不回归
  - 依赖：1.x、2.x；优先级 P0

- [x] 3.2 更新 `openspec/changes/README.md` active 行
  - 验证：change id 可点
  - 依赖：artifacts 齐；优先级 P2

- [ ] 3.3 手测（不 archive）：Claude / Grok / DSH 各跑一轮多步 todo_write
  - 验证：进行中任务 pill 跟着变；幕布仍不画 TodoWrite 卡；重载后不回退
  - 依赖：3.1；优先级 P0
