# Design: fix-todo-write-file-change-misclassify

## Context

Composer 任务 pill 的数据源是 `useStatusPanelData`：正向扫当前会话 tool items，只认

```
extractToolName(title) ∈ { todowrite, todo_write }
AND parseToolArgs(detail).todos 是数组
```

取**最后一次**能解析的整表。

Live 分类在 `src-tauri/src/engine/events.rs` `resolve_tool_item_kind`：

```
name.contains("write") → FileChange
```

`TodoWrite` / `todo_write` 都命中。`engine_event_to_app_server_event` 于是发出 `type: "fileChange"`。`buildConversationItem` 的 fileChange 臂把 `detail` 收成路径摘要 / `"Pending changes"`。任务条 `parseToolArgs` 失败，整次更新被跳过。

审批路径同一套 `contains("write")`，会把 `todo_write` 错送到 `item/fileChange/requestApproval`。Shared projector `is_edit_like_tool_name` 同样含 `write`。

History 不走这条：Claude 只精确匹配 `write` / `edit` / `delete`；Grok `FILE_CHANGE_TOOL_TYPES` 是精确集合。所以 history 重载后任务条能回正。

DSH Web 另读 `todos` 投影，本 change 不接。本补丁只保证工具行本身不再被误伤。

## Goals / Non-Goals

**Goals:**

1. Live / Shared 分类把 checklist 工具从 `write` 通配里摘出。
2. `arguments` / `detail` 保留 `{ todos: [...] }`，任务 pill 当次可更新。
3. 真文件工具分类不变。
4. 审批 method 不把 checklist 当 fileChange。

**Non-Goals:**

- DSH `todo/write` 事件、`session/projection.todos`。
- Codex `update_plan` 并入任务 pill。
- 改变幕布隐藏 TodoWrite 的策略。
- 客户端重算 DSH standing-plan 生命周期。

## Decisions

### D1. 在分类源头排除，不在 UI 特判

**选定**：`resolve_tool_item_kind` 在 `contains("write")` 之前识别 checklist compact name。

```
compact = lower.replace(['_', '-'], "")
if compact == "todowrite" || compact.ends_with("todowrite") {
    return MpcToolCall
}
```

`mcp__*__TodoWrite` 一并覆盖。`write` / `write_file` / `Write` 仍 FileChange。

不采用：只在 `useStatusPanelData` 回读 fileChange.raw arguments。治标，且「已编辑」pill 仍吃假变更。

### D2. 审批与 Shared 同步摘出

**选定**：

- `EngineEvent::ApprovalRequest` 的 `contains("write")` 臂同样先排除 checklist。
- `shared_projection/projector.rs` `is_edit_like_tool_name` 排除 `todowrite`。Shared 注释已写明「Keep original tool names for Write/Edit/Read」，checklist 更不该被收成 edit。

OpenCode `should_stream_tool_output` 的 `contains("write")` **不改**：那是要不要 stream output，不是 item kind。checklist 几乎无 output stream，改了也无产品收益。

### D3. 前端只做防守，不另开数据通道

**选定**：若 `buildConversationItem` 因 `type === "fileChange"` 仍可能吞掉 arguments，加一条 name 守卫：title/tool 是 `todo_write` 时走 generic tool（保留 JSON detail）。这是回归网，不是主路径。主路径应在 D1 之后根本不进 fileChange 臂。

`useStatusPanelData` 扫描合同不变：仍只认两种名字 + `todos` 数组。

### D4. 不扩展任务条认名字

`update_plan`、DSH `todo/write`、turn plan 不在本 change。Codex 协作模式继续走 `mergePlanIntoTodos`。

## Risks / Trade-offs

- 漏网别名（`write_todos`）仍会被当成 fileChange。本 change 只钉官方 `TodoWrite` / `todo_write`。新别名另开 change。
- 若某引擎真有名叫 `todo_write` 的文件工具，会被改成 mcpToolCall。仓库内无此工具。
- 本补丁修好 live 工具行后，DSH 在 `turn/start` 后仍可能显示上一轮清单——那是投影生命周期，归 `wire-dsh-todos-and-context-usage`。

## Migration

无数据迁移。已持久化的错误 fileChange 行不会回写；新 live 事件与之后的 history 重载走正确分类。

## Open Questions

无。DSH 权威投影明确拆到下一个 change。
