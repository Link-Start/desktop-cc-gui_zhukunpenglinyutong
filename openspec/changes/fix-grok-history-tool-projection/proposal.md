## Why

Grok 历史幕布把工具几乎都渲染成「Tool」扳手卡，无法按读文件 / 改文件 / 命令 / 搜索分组。

根因：真实 `chat_history.jsonl` 的 `tool_calls` 是 `{ id, name, arguments }`，而 `grok_history.rs` 只读 nested `function.name`，缺失时 fallback 为 `tool`。

## 目标与边界

### 目标

- History 解析同时支持 flat（`name`/`arguments`）与 nested（`function.*`）。
- 保留真实 tool 名与参数；`tool_result` 与 call 配对。
- 投影结果可被共享 `toolSemantics` 分类，进入既有幕布分组（read / edit / bash / search；`todo_write` 仍隐藏）。

### 非目标

- 不改 live reasoning 渲染（deferred 等）。
- 不重做文件折叠 UI（已有；修好 name 后自然可用）。
- 不上 ACP 实时 tool 事件。
- 不改其它引擎 history wire。

## What Changes

- `src-tauri/src/engine/grok_history.rs`：双格式 name/arguments + tests。
- `src/utils/toolSemantics.ts`（最小）：补齐/锁死 `list_dir`→read、`search_replace`→edit 等。
- 相关 FE 测试：分组可命中 readGroup / editGroup 等。

## 技术方案比较

| 方案 | 结论 |
|------|------|
| 只改 FE 猜工具类型 | 拒绝：事实名仍错 |
| 修 history 解析 + 最小分类表 | **采用** |
| ACP 实时 tool | 非本期 |

## Capabilities

### New

- `grok-history-tool-projection`

### Modified

- `conversation-realtime-history-parity`：Grok live 可无 tool 行；history 不得整批退化为 `tool`
- `generic-tool-presentation`：可分类工具不得因丢 name 而大面积变 unknown `Tool`

## 验收标准

- flat 样本投影后 title 为真实名（如 `read_file`），不是 `tool`。
- nested 旧 fixture 仍通过。
- call/result 配对正确。
- 连续同类工具可进对应 group；`todo_write` 仍隐藏。
- `toolType` specialization 仅匹配 exact allowlist；`get_command_or_subagent_output`
  等未知真实 name 不得因 substring 被误投影为 command/file-change。
- `list_dir.target_directory` 在 read group 中保留目录身份并显示为 `List`。
- 人工重载真实 Grok 历史：不再「一排 Tool」。
- `cargo test`（grok_history）+ focused Vitest + typecheck + `openspec validate --strict`。

## Impact

- Backend：`grok_history.rs`
- Frontend：`toolSemantics`（最小）+ tests
- 回滚：恢复 nested-only 解析即可
