## Why

当前多个 runtime forwarder 和 Codex 独立路径分别翻译或分发事件，frontend bridge 事实上承担了跨引擎归一化。未来 persistence、plugin hooks 和 orchestration 若直接接这些路径，会形成多套事件真相和不一致的完成语义。

## 目标与边界

- 在 Rust runtime 内建立统一 `MossxAgentEvent` bus。
- 所有事件携带 provenance、session/run/turn/item identity。
- 建立幂等、唯一的 `run:settled` 完成边界。
- 保留现有 frontend app-server contract 与渲染性能基线。

## What Changes

- engine-specific event 先映射为统一 envelope，再 fan-out 到 frontend、diagnostics 和可选 persistence sink。
- 扩展 domain event schema，增加 run identity、provenance 与 `run.settled`。
- bus publish 保持 runtime-private；application consumer 只能订阅。
- sink 隔离失败和背压；一个 consumer 不得阻塞 engine reader。

## 方案比较与取舍

- 方案 A：在 React reducer 后派生统一事件。实现快，但丢失 backend provenance，且会放大 root render，拒绝。
- 方案 B：Rust ingress 归一化 + frontend compatibility bridge。采用；事实只解析一次，并为后续 consumer 留稳定边界。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `agent-domain-event-schema`: 增加 runtime identity、provenance 与 `run.settled`。
- `agent-domain-event-runtime`: 从“禁止 runtime/IPC”演进为 Rust-side bus 与受控跨边界 subscription contract。

## 验收标准

- 所有活跃 engine 事件先进入统一 bus。
- 每个 run 恰好产生一个幂等 `run:settled`。
- frontend 行为保持兼容，流式正文继续走 `liveAssistantTextChannel`。
- bus 不逐 delta 写入 AppShell root state；现有 batching/critical bypass 保留。
- sink failure、slow consumer、duplicate terminal event 有 Rust focused tests。

## 非目标

- 不实现 plugin runtime 或 marketplace。
- 不实现 durable orchestration log。
- 不把 public publish API 暴露给 frontend consumer。

## Impact

- Rust engine runtime、forwarders、Tauri event bridge、diagnostics。
- TypeScript domain event schema、frontend event adapter。
- Realtime batching、render regression harness。
