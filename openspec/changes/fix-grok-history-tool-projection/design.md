## Context

```
tool_calls flat {name,arguments}
  → grok_history 只读 function.name → "tool"
  → 幕布 Generic「Tool」× N
```

修解析后复用既有 `groupToolItems` / *ToolGroupBlock。

## Decisions

### D1. 双格式 name / arguments

1. `call.name` / `call.arguments`
2. else `call.function.name` / `call.function.arguments`
3. else name = `"tool"`

arguments 若为 JSON 字符串则 parse 为 object 写入 `tool_input`。

### D2. 分类最小扩展

| name | category |
|------|----------|
| `read_file` | read（已有） |
| `list_dir` | read（补） |
| `grep` | search（已有） |
| `run_terminal_command` | bash（锁 includes/terminal） |
| `search_replace` | edit（补） |
| `todo_write` | hide（已有） |

### D3. Live 无 tool 不算 bug

streaming-json 无 tool 事件；仅 history 有 tool 行。parity 不要求 live/history tool 基数一致。

## Test

- Rust：flat multi-tool + result pairing；nested 回归；缺 name
- FE：toolSemantics；groupToolItems 连续 read/edit
- 手工：重载真实 Grok 会话
