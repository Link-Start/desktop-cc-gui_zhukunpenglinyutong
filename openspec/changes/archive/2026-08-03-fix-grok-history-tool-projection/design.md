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

`toolType` specialization 使用 exact allowlist，不使用 `includes("command")` /
`includes("write")`。真实未知 name 保留 generic fallback；只有
`run_terminal_command` 等明确 command tool 才转为 `commandExecution`。

### D3. 目录读取参数

`ReadToolGroupBlock` 同时识别 file path 与 directory path。Grok
`list_dir.target_directory` 必须保留路径，并依据 tool name / directory key 显示
`List`，不能退化为 `Read ...`。

### D4. Live 无 tool 不算 bug

streaming-json 无 tool 事件；仅 history 有 tool 行。parity 不要求 live/history tool 基数一致。

## Test

- Rust：flat multi-tool + result pairing；nested 回归；缺 name
- FE：toolSemantics；groupToolItems 连续 read/edit
- 手工：重载真实 Grok 会话
