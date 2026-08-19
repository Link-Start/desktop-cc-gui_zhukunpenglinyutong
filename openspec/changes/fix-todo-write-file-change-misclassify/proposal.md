# Proposal: fix-todo-write-file-change-misclassify

> OpenSpec change id: `fix-todo-write-file-change-misclassify`  
> 现场：Claude / Grok / DSH 对话进行中，Composer 任务 pill 停在上一轮 `TodoWrite`  
> 正交：`wire-dsh-todos-and-context-usage`（DSH 权威 `todos` 投影 + 上下文占用）  
> 本 change **不** 接 DSH `todo/write` / `session/projection`，不改 Codex `update_plan`

---

## Why

Composer 任务条全引擎共用，只扫最后一条 title 为 `TodoWrite` / `todo_write` 且 `detail` 能解析出 `{ todos: [...] }` 的 tool。

Live 路径里，`EngineEvent` → app-server item 的分类用 `tool_name.contains("write")`。`TodoWrite` 与 `todo_write` 都命中，被标成 `fileChange`。前端再建卡片时 `detail` 变成路径摘要或 `"Pending changes"`，任务条解析失败，继续显示上一轮还能解析的旧清单。

这不是 DSH 特例。Claude `TodoWrite`、Grok / Kimi `todo_write` 走同一条 live 分类。History 相对安全：Claude / Grok history 用精确名匹配，不会把 `todo_write` 收成 fileChange。所以常见观感是「进行中卡住，重载后对齐」。

DSH 网页另有 `todos` 投影，本 change 不接。没有本补丁时，即便后续接上投影，live `todo_write` 工具行仍会污染「已编辑」pill。

## What Changes

- `resolve_tool_item_kind` 把 `todo_write` / `todowrite` / `TodoWrite` 从 `write` 通配里摘出来，保持 `mcpToolCall`，保留 title + arguments。
- 审批分类同样排除：`todo_write` 不得走 `item/fileChange/requestApproval`。
- Shared projector 的 `is_edit_like_tool_name` 同步排除，避免 Shared Claude 把 TodoWrite 当 edit。
- 前端 `buildConversationItem` 不把 `todo_write` 收成 `fileChange`；任务条继续吃 `{ todos }` JSON。
- 补 Rust / vitest：live `TodoWrite` / `todo_write` 的 item type、detail、任务条更新。

**非 BREAKING**。真文件工具（`write` / `write_file` / `Write`）分类不变。

## 目标与边界

- **目标**：凡是任务工具名为 `TodoWrite` / `todo_write` 的引擎，live 任务 pill 必须跟上当次整表替换。
- **边界**：只修分类与 arguments 保留。不新增任务数据通道，不改 Codex plan，不接 DSH 投影。

## 非目标

- 不订阅 DSH `todo/write` 或 `session/projection.todos`（见 `wire-dsh-todos-and-context-usage`）。
- 不让任务条认 `update_plan` / turn plan。
- 不改 DSH `turn/start` 清空 standing plan 的语义。
- 不把 TodoWrite 重新画回幕布（继续 `shouldHideToolItemForRender`）。
- 不回写基石 ADR（未改 registry / Shared 支持集合 / ACK）。

## Capabilities

### New Capabilities

- `todo-write-tool-classification`: live / Shared 不得把 checklist 工具收成 fileChange；任务条必须能从当次 arguments 读到 `todos`。

### Modified Capabilities

- `grok-history-tool-projection`: 补一条 live 合同——`todo_write` 在 realtime 也不得因名字含 `write` 被重写成 `fileChange`。History 既有「精确名匹配」保持。

## Impact

- Backend: `src-tauri/src/engine/events.rs`（`resolve_tool_item_kind` + approval method）、`src-tauri/src/shared_projection/projector.rs`（`is_edit_like_tool_name`）。
- Frontend: 若 `buildConversationItem` / fileChange infer 仍会吞掉 `todo_write` arguments，一并挡住。
- Tests: events.rs 单测 + `useStatusPanelData` / threadItems / realtime adapter focused 用例。
- Docs: 本 change。DSH 网页对齐不在本 change 验收。

## 技术方案对比

| 选项 | 描述 | 取舍 |
|---|---|---|
| A. 只在任务条扫描 `fileChange` 的 raw arguments | Composer 特判 | 治标；「已编辑」pill 仍会吃到假 fileChange |
| B. 前端 `isEditTool` 已排除 todo，再在 `buildConversationItem` 反悔 | 只改 FE | 后端 item type 仍是 fileChange，审批 / outputDelta 仍走错通道 |
| **C. 分类源头排除 checklist 名（推荐）** | Rust `resolve_tool_item_kind` + 审批 + Shared projector 同步摘出 | 一次修 Claude / Grok / Kimi / DSH live；history 本就安全 |

采用 **C**。

## 验收标准

1. Live `ToolStarted { tool_name: "todo_write" | "TodoWrite" }` 投影为 `mcpToolCall`（或等价非 fileChange），`title`/`tool` 保留原名，`arguments` 仍是 `{ todos: [...] }`。
2. Composer 任务 pill 在同回合第二次 `todo_write` 后换成新清单，不得停在上一轮 3/3。
3. `write` / `write_file` / `Write` / `search_replace` 仍是 fileChange。
4. `todo_write` 审批不得走 `item/fileChange/requestApproval`。
5. 幕布继续隐藏 TodoWrite 工具卡。
6. focused cargo test + vitest 绿。不 commit。
