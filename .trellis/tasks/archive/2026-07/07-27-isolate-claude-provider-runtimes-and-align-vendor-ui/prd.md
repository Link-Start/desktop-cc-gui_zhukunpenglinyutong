# 隔离 Claude provider runtime 与供应商 UI

## OpenSpec

- Change: `openspec/changes/isolate-claude-provider-runtimes-and-align-vendor-ui/`

## 验收

- Claude 新会话选择的 managed provider 进入 durable thread binding。
- 同一 workspace 的 local、provider A、provider B 拥有独立 runtime owner；并行 child process 不串 env 或 turn state。
- AskUserQuestion、approval resume、retry 与 compaction 继承原 thread provider。
- managed provider 状态显示“新会话可选”，不再提供 global switch。
- CLI header 的 version/update/refresh actions 在窄宽度正常换行且不重叠。
