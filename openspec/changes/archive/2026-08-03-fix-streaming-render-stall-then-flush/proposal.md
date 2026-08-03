## Why

长回复流式输出存在“前段可见、随后停住、最后一次性刷出”的客户端表现。Frontend render starvation 是一个已处理的放大因素；后续排查又确认两处 ordering defect：Codex `BatchedTauriEventSink` 与统一 `appServerEventBackpressure` 都允许 terminal critical event 越过已接受的正文事件。Frontend 会先结算 turn，再把迟到正文视为 stale event 丢弃。需要在不恢复幕布轻量渲染与 virtualization 的前提下，同时建立可验证的发布节奏与 terminal causal ordering。

## 目标与边界

- 将 live text 的“权威累积值”与“React 可观察 published snapshot”分离。
- 首个可见文本立即发布，后续更新按 thread 以约 `48ms` trailing cadence 合并。
- terminal、interruption、tool boundary、thread rename 与 reset 路径保持无损并清理 timer。
- live channel 已完成节流后，移除 row / Markdown 路径上的重复可中断调度。
- Codex batched transport 必须在 terminal 前 flush 同 sink、同 workspace 已排队的 causal predecessors。
- unified frontend backpressure 必须在 terminal 前向既有 scheduled consumer 交付同 workspace predecessors；其他 workspace 保持隔离。
- approval / requestUserInput 等 interactive critical event 继续保持 urgent bypass，不与 terminal settlement 混为一类。
- 保持 `TIMELINE_ADAPTIVE_RENDERING_ENABLED = false`；幕布继续使用 static full-detail DOM。
- Shared runtime owner defer 本轮只补 attribution / overflow evidence，不改变权威 owner barrier。

## 非目标

- 不恢复 conversation lightweight mode、timeline virtualization 或渲染预算提示。
- 不调整消息 anchor DOM、滚动坐标系或上一变更中的 scroll echo contract。
- 不把 JavaScript timer cadence 宣称为 DOM commit 的硬实时保证。
- 不修改 Claude / Gemini / Kimi / Grok / OpenCode engine adapter；它们通过统一 frontend barrier 获得 ordering 保护。
- 不修改 Shared owner binding / replay barrier，也不扩散到当前无 production subscriber 的 `AgentEventBus`。
- 不把 provider 的 sparse / bursty output 当成允许客户端重排 terminal 的理由。

## What Changes

- `liveAssistantTextChannel` 维护 accumulated entry 与 published snapshot，首帧立即、后续按 thread trailing publish。
- `clear`、`drain`、`rename`、`reset` 取消或迁移 pending publish，终态读取 accumulated text，避免 stale snapshot 丢字。
- channel-backed live assistant row 直接消费 published text，不再叠加 `useDeferredValue`。
- bounded Markdown streaming commit 使用确定性 scheduled commit，不再用可被连续输入反复打断的 transition。
- Codex terminal event 在 Rust batch sink 内转换为 per-workspace ordering barrier；interactive critical event 保留 urgent bypass。
- `appServerEventBackpressure` 为 app-server terminal event 提供可选 causal barrier key，在不同步执行 reducer 的情况下先交付同 workspace predecessors。
- 扩展 privacy-safe diagnostics，明确区分 source arrival、channel publish、row render 与 Shared owner defer/overflow。

## 方案比较与取舍

### 方案 A：只增大 Markdown throttle

改动最小，但 `useSyncExternalStore` 仍会被每个 delta 唤醒，且 `useDeferredValue` / `startTransition` 的饥饿链仍在。只能降低部分 Markdown 成本，不能闭环。

### 方案 B：在 live channel 建立单一发布节奏（采用）

channel 仍逐 delta 无损累积，只对 React published snapshot 做 trailing coalescing；row 与 Markdown 去掉重复可中断调度。节奏入口唯一，terminal 可同步 drain，回滚继续复用现有 `ccgui.perf.liveTextExternalization=0`。

### 方案 C：恢复 virtualization / lightweight conversation mode

可能减少历史 DOM 成本，但会重新引入 static-to-virtual 坐标切换与 anchor 错位，和已确认的全量渲染硬禁用直接冲突，本轮拒绝。

### 方案 D：按每个 CLI adapter 分别补 terminal guard

会复制相同 ordering policy，且无法覆盖 `CCGUI_APP_SERVER_EVENT_BATCH=0` 与统一 frontend backpressure 的第二次重排。拒绝。采用“Codex backend 局部纠正 + unified frontend contract”。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `conversation-realtime-client-performance`: 增加 live text published snapshot cadence、无损终态与 bounded scheduled commit contract。
- `conversation-live-message-canvas-rendering`: 明确该性能修复不得恢复 adaptive timeline rendering，anchor 继续基于 static full-detail DOM。

## Impact

- Frontend：`src/features/threads/utils/liveAssistantTextChannel.ts`、`src/features/messages/components/MessageRow.tsx`、`src/markdown/hooks/useMarkdownStreamingValue.ts`、`src/services/eventBackpressure.ts`、`src/services/events.ts` 及对应 focused tests。
- Backend：仅修改 Codex 使用的 `src-tauri/src/event_sink.rs`；不修改其他 engine adapter 或 Shared coordinator。
- Diagnostics：复用现有 `streamLatencyDiagnostics`，只增加 bounded phase attribution，不记录正文。
- Runtime：不新增 dependency，不修改 command/public API，不修改 authoritative lifecycle。
- Rollback：关闭现有 `ccgui.perf.liveTextExternalization`，回到 reducer-backed live text；adaptive rendering 仍保持关闭。

## 验收标准

- 同一 thread 的第一段文本立即通知；之后 48ms 窗口内多个 delta 只触发一次 trailing publish。
- `getSnapshot` 在 listener notification 之间保持 referentially stable，不暴露尚未发布的 accumulated value。
- `drain`、`clear`、`rename`、`reset` 后无 pending timer 泄漏，terminal/interruption 最终文本逐字一致。
- channel-backed live row 不再经过 `useDeferredValue`；scheduled Markdown commit 不再被连续 transition 重启而无限推迟。
- `delta → item/completed → turn/completed` 在 Codex batch、single fallback、其他 engine direct emit 与 Shared projection 路径都按 causal order 进入 frontend dispatcher。
- terminal barrier 只提前交付同 workspace predecessors，不 drain unrelated workspace；interactive critical event 仍可 urgent bypass。
- `TIMELINE_ADAPTIVE_RENDERING_ENABLED` 仍为 `false`，不出现 lightweight prompt，不修改 anchor 结构。
- focused Vitest、typecheck、定向 ESLint、`openspec validate ... --strict` 通过；不运行全量测试。
