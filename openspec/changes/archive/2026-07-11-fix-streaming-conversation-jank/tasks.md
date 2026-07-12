# Tasks

## 1. 诊断落盘节流（rendererDiagnostics）

- [x] 1.1 `appendRendererDiagnostic` preload 完成后改为写入 pending buffer，并以 leading + trailing throttle（2s）触发合并落盘；首个 append 立即落盘以保留既有语义。
- [x] 1.2 `exportRendererDiagnostics` 合并 pending buffer，保证只读视图不丢条目。
- [x] 1.3 `clearRendererDiagnostics` 清空 pending buffer 并取消挂起的 flush timer。
- [x] 1.4 `flushRendererDiagnosticsBuffer` 同时冲刷 pre-preload buffer 与 pending buffer。
- [x] 1.5 `pagehide` / `visibilitychange(hidden)` 时立即冲刷 pending buffer，防止崩溃丢失现场。
- [x] 1.6 更新 `rendererDiagnostics.test.ts` 覆盖节流合并行为。

## 2. stream-latency trace 默认关闭

- [x] 2.1 `isStreamLatencyTraceEnabled` 移除 `env.DEV === true` 默认开启分支，仅保留 localStorage flag 与 `VITE_ENABLE_PERF_BASELINE`。

## 3. 流式 lightweight markdown 全覆盖

- [x] 3.1 `shouldUseLightweightStreamingMarkdown` 放宽为：staged streaming 引擎 + 流式 + 非空文本即走 lightweight（去掉 isMedium / isStructuredHeavy 门槛）。
- [x] 3.2 ReasoningRow live 阶段 `liveRenderMode="lightweight"`，settle 后回到 full。
- [x] 3.3 更新相关渲染测试。

## 4. delta flush 节奏

- [x] 4.1 `REALTIME_DELTA_BATCH_FLUSH_MS` / `NORMALIZED_REALTIME_BATCH_FLUSH_MS` 12ms → 32ms。
- [x] 4.2 同步更新依赖 20ms 推进的测试用例（advanceTimersByTime 20 → 40；integration 用例先消化 24ms lazy-resume timer）。

## 6. Timeline 虚拟化 + 流式渲染路径（DMG 掉帧归因后续）

- [x] 6.1 启用流式期虚拟化（`TIMELINE_VIRTUALIZATION_DURING_STREAMING_ENABLED=true`，门槛 32 rows）。
- [x] 6.2 稳定态虚拟化门槛 200 → 48 rows，覆盖 ~56 可见行 idle 卡顿。
- [x] 6.3 短文本（<260 chars）流式期关闭 `progressiveReveal`，减少 double-buffer commit。
- [x] 6.4 lightweight 模式跳过 `parseToolCallBlocks`；流式期跳过 `onOutlineReady`。
- [x] 6.5 Codex/Claude 短文本 throttle 48 → 72ms。
- [x] 6.6 `MessagesTimeline` 增加 `timeline-list-render` hotspot；修复 React Scan 启动顺序。
